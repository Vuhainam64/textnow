/**
 * mlxService.js - Tích hợp MLX (Multilogin X) API
 * --------------------------------------------------
 * Quản lý toàn bộ lifecycle của browser profile MLX:
 * đăng nhập, khởi động/dừng profile, tạo/xoá profile,
 * tìm kiếm và dọn dẹp group.
 *
 * ⚠️  QUAN TRỌNG - ESM Loading Order:
 * Trong ESM, tất cả import chạy trước code body của module gọi.
 * Vì vậy KHÔNG đọc process.env ở module-level (const X = process.env.Y)
 * vì dotenv.config() trong server.js chưa chạy lúc đó.
 * Thay vào đó dùng hàm getConfig() để đọc lazily khi cần.
 *
 * Cách dùng:
 *   import mlx from './services/mlxService.js';
 *
 *   // Gọi 1 lần lúc server start:
 *   await mlx.signin();
 *
 *   // Dùng trong automation:
 *   const { wsEndpoint } = await mlx.startProfile(profileId);
 *   await mlx.stopProfile(profileId);
 */

import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ─── Lazy config reader ───────────────────────────────────────────────────────
// Hàm này đọc env tại thời điểm GỌI (không phải lúc module load)
// → đảm bảo dotenv.config() trong server.js đã chạy trước
function getConfig() {
    return {
        email: process.env.MLX_USER,
        password: process.env.MLX_PASSWORD,
        host: process.env.MLX_HOST || 'https://api-mult.mmovn.xyz',
        launcherV1: process.env.MLX_LAUNCHER_V1 || 'https://launcher.mlx.yt:45001/api/v1',
        launcherV2: process.env.MLX_LAUNCHER_V2 || 'https://launcher.mlx.yt:45001/api/v2',
        groupId: process.env.MLX_GROUP_ID,
        teamId: process.env.MLX_TEAM_ID,
        localProfilesPath: process.env.MLX_LOCAL_PROFILES_PATH || path.join(os.homedir(), 'mlx', 'profiles'),
    };
}

// ─── MLXService class ─────────────────────────────────────────────────────────

class MLXService {
    constructor() {
        this.token = null;
        this.refreshToken = null;
        this.userInfo = null;
        this._signinPromise = null; // Bảo vệ khỏi gọi đồng thời
        this._api = null; // Lazy-initialized axios instance
    }

    /**
     * Axios instance → MLX API host.
     * Lazy getter: chỉ khởi tạo lần đầu (sau khi env đã load).
     */
    get api() {
        if (!this._api) {
            this._api = axios.create({
                baseURL: getConfig().host,
                timeout: 30_000,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            });
            // Tự động gắn Bearer token vào mọi request
            this._api.interceptors.request.use((req) => {
                if (this.token) req.headers['Authorization'] = `Bearer ${this.token}`;
                return req;
            });
        }
        return this._api;
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /** Hash MD5 mật khẩu (yêu cầu của MLX API) */
    _hashPassword(password) {
        return crypto.createHash('md5').update(password).digest('hex');
    }

    /** Delay ms */
    _delay(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    // ─── AUTH ─────────────────────────────────────────────────────────────────

    /**
     * Đăng nhập vào MLX. Nên gọi 1 lần duy nhất lúc server start.
     * Nếu gọi đồng thời nhiều lần → chỉ chạy 1 lần thực sự (singleton promise).
     *
     * @param {number} maxRetries - Số lần retry (mặc định: 5)
     * @returns {Promise<boolean>}
     */
    async signin(maxRetries = 5) {
        if (this._signinPromise) return this._signinPromise;

        this._signinPromise = (async () => {
            console.log('[MLX] 🔐 Đang xác thực với MLX...');
            const { email, password } = getConfig();

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const response = await this.api.post('/user/signin', {
                        email,
                        password: this._hashPassword(password),
                    });

                    if (response.data?.status?.http_code === 200) {
                        const { token, refresh_token, ...userData } = response.data.data;
                        this.token = token;
                        this.refreshToken = refresh_token;
                        this.userInfo = userData;
                        console.log('[MLX] ✅ Đăng nhập MLX thành công');
                        return true;
                    }
                    throw new Error(response.data?.status?.message || 'Lỗi đăng nhập không xác định');

                } catch (err) {
                    const msg = err.response?.data?.status?.message || err.message;
                    console.error(`[MLX] ❌ Đăng nhập lần ${attempt}/${maxRetries} thất bại: ${msg}`);

                    if (attempt === maxRetries) {
                        this._signinPromise = null;
                        throw err;
                    }
                    // Exponential backoff: 2s → 4s → 8s → tối đa 10s
                    await this._delay(Math.min(1000 * Math.pow(2, attempt), 10_000));
                }
            }
        })();

        const result = await this._signinPromise;
        this._signinPromise = null;
        return result;
    }

    // ─── FOLDERS / GROUPS ────────────────────────────────────────────────────

    /**
     * Lấy danh sách tất cả folders/groups trong workspace.
     * Endpoint: GET /workspace/folders
     *
     * @returns {Promise<Array>} Mảng folder objects
     */
    async getFolders() {
        const response = await this.api.get('/workspace/folders');
        if (response.data?.status?.http_code !== 200) {
            throw new Error(response.data?.status?.message || 'Lấy folders thất bại');
        }
        return response.data.data.folders || [];
    }

    /**
     * Tạo folder mới trong workspace.
     * Endpoint: POST /workspace/folder_create
     * Body: { name, comment }
     *
     * @param {string} name
     * @param {string} [comment]
     * @returns {Promise<string>} folder_id mới
     */
    async createFolder(name, comment = '') {
        const response = await this.api.post('/workspace/folder_create', { name, comment });
        if (response.data?.status?.http_code !== 200) {
            throw new Error(response.data?.status?.message || 'Tạo folder thất bại');
        }
        return response.data.data.id;
    }

    /**
     * Cập nhật folder (tên, comment).
     * Endpoint: POST /workspace/folder_update
     * Body gửi toàn bộ object folder (gồm cả created_at, profiles_count).
     *
     * @param {object} folderData - Object folder đầy đủ từ getFolders()
     * @param {string} folderData.folder_id
     * @param {string} folderData.name
     * @param {string} [folderData.comment]
     * @param {string} [folderData.created_at]
     * @param {number} [folderData.profiles_count]
     * @returns {Promise<boolean>}
     */
    async updateFolder(folderData) {
        const response = await this.api.post('/workspace/folder_update', folderData);
        return response.data?.status?.http_code === 200;
    }

    /**
     * Xoá một hoặc nhiều folder.
     * Endpoint: POST /workspace/folders_remove
     * Body: { ids: [folder_id, ...] }
     *
     * @param {string|string[]} folderIds
     * @returns {Promise<boolean>}
     */
    async removeFolder(folderIds) {
        const ids = Array.isArray(folderIds) ? folderIds : [folderIds];
        const response = await this.api.post('/workspace/folders_remove', { ids });
        return response.data?.status?.http_code === 200;
    }

    // ─── PROFILE LIFECYCLE ────────────────────────────────────────────────────

    /**
     * Khởi động profile ở chế độ Playwright → trả về wsEndpoint để kết nối CDP.
     * @param {string} profileId
     * @returns {Promise<{ port: number, wsEndpoint: string }>}
     */
    async startProfile(profileId) {
        const { launcherV2, groupId } = getConfig();
        console.log(`[MLX] 🚀 Đang khởi động profile ${profileId}...`);

        // Đôi khi profile mới tạo cần vài giây để đồng bộ xuống Agent local
        await this._delay(2000);

        const url = `${launcherV2}/profile/f/${groupId}/p/${profileId}/start?automation_type=playwright`;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await axios.get(url, {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000
                });

                if (response.data?.status?.http_code !== 200) {
                    throw new Error(response.data?.status?.message || 'Không thể khởi động profile');
                }

                const port = response.data.data.port;
                console.log(`[MLX] ✅ Profile chạy trên port ${port}`);
                return { port, wsEndpoint: `ws://127.0.0.1:${port}` };
            } catch (err) {
                const errorData = err.response?.data;
                console.error(`[MLX] ❌ Lần thử ${attempt}/3 khởi động profile thất bại:`,
                    errorData ? JSON.stringify(errorData, null, 2) : err.message);

                if (attempt === 3) {
                    if (errorData) {
                        throw new Error(errorData.status?.message || `Lỗi Launcher: ${err.response.status}`);
                    }
                    throw err;
                }

                // Chờ và thử lại (có thể Agent đang bận hoặc chưa sync xong)
                await this._delay(3000);
            }
        }
    }

    /**
     * Dừng profile (retry tối đa 3 lần).
     * @param {string} profileId
     */
    async stopProfile(profileId) {
        const { launcherV1 } = getConfig();
        const url = `${launcherV1}/profile/stop/p/${profileId}`;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await this.api.get(url);
                console.log(`[MLX] ✅ Profile ${profileId} đã dừng`);
                return;
            } catch (err) {
                console.warn(`[MLX] ⚠️ Lần ${attempt}/3 dừng profile thất bại: ${err.message}`);
                if (attempt < 3) await this._delay(2000);
                else console.error(`[MLX] ❌ Không thể dừng profile ${profileId} sau 3 lần`);
            }
        }
    }

    // ─── PROFILE MANAGEMENT ───────────────────────────────────────────────────

    /**
     * Tìm kiếm profiles trong một folder.
     * @param {string} groupId
     * @param {number} offset
     * @param {number} limit
     * @returns {Promise<{ profiles: Array, total: number }>}
     */
    async searchProfiles(groupId, offset = 0, limit = 50) {
        const response = await this.api.post('/profile/search', {
            folder_id: groupId,
            offset,
            limit,
            search_text: '',
            storage_type: 'all',
            browser_type: null,
            os_type: null,
            is_removed: false,
            order_by: 'created_at',
            sort: 'desc',
        });

        if (response.data?.status?.http_code !== 200) {
            return { profiles: [], total: 0 };
        }
        return {
            profiles: response.data.data.profiles || [],
            total: response.data.data.total_count || 0,
        };
    }

    /**
     * Tạo profile mới trong group mặc định.
     * @param {string} name - Tên profile
     * @param {{ type, host, port, username?, password? }|null} proxy
     * @returns {Promise<string>} profileId
     */
    async createProfile(name, proxy = null, config = {}) {
        const { groupId } = getConfig();
        const landingPage = config.url || '';
        console.log(`[MLX] 🛠️ Đang tạo profile "${name}" (Landing: ${landingPage || 'default'})...`);

        const payload = {
            browser_type: 'mimic',
            folder_id: groupId,
            name,
            os_type: 'windows',
            parameters: {
                fingerprint: {},
                flags: {
                    navigator_masking: 'mask',
                    audio_masking: 'mask',
                    localization_masking: 'mask',
                    geolocation_popup: 'prompt',
                    geolocation_masking: 'mask',
                    timezone_masking: 'mask',
                    graphics_noise: 'mask',
                    graphics_masking: 'mask',
                    webrtc_masking: 'disabled',
                    fonts_masking: 'mask',
                    media_devices_masking: 'mask',
                    screen_masking: 'mask',
                    proxy_masking: proxy ? 'custom' : 'disabled',
                    ports_masking: 'mask',
                    canvas_noise: 'mask',
                    startup_behavior: 'custom',
                    landing_page: landingPage,
                },
                storage: { is_local: true, save_service_worker: null },
            },
        };

        if (proxy) {
            payload.parameters.proxy = {
                type: proxy.type || 'socks5',
                host: proxy.host,
                port: parseInt(proxy.port),
                ...(proxy.username && { username: proxy.username }),
                ...(proxy.password && { password: proxy.password }),
            };
        }

        const response = await this.api.post('/profile/create', payload);
        if (response.data?.status?.http_code !== 201) {
            throw new Error(response.data?.status?.message || 'Tạo profile thất bại');
        }

        const profileId = response.data.data.ids[0];
        console.log(`[MLX] ✅ Profile tạo thành công: ${profileId}`);
        return profileId;
    }

    /**
     * Xoá 1 hoặc nhiều profile vĩnh viễn.
     * @param {string|string[]} profileIds
     */
    async removeProfile(profileIds) {
        const ids = Array.isArray(profileIds) ? profileIds : [profileIds];
        console.log(`[MLX] 🗑️ Đang xoá ${ids.length} profile trên cloud...`);

        const response = await this.api.post('/profile/remove', { ids, permanently: true });
        if (response.data?.status?.http_code !== 200) {
            throw new Error(response.data?.status?.message || 'Xoá profile thất bại');
        }
        console.log(`[MLX] ✅ Đã xoá ${ids.length} profile trên cloud`);
        return true;
    }

    /**
     * Xoá folder profile dưới máy local.
     * @param {string} profileId
     */
    async deleteLocalProfile(profileId) {
        const { teamId, localProfilesPath } = getConfig();
        if (!teamId) throw new Error('Cấu hình MLX_TEAM_ID còn thiếu');

        const profilePath = path.join(localProfilesPath, teamId, teamId, profileId);

        console.log(`[MLX] 📂 Đang xoá folder profile local: ${profilePath}`);
        try {
            await fs.rm(profilePath, { recursive: true, force: true });
            console.log(`[MLX] ✅ Đã xoá folder profile local: ${profileId}`);
            return true;
        } catch (err) {
            console.error(`[MLX] ❌ Lỗi khi xoá folder profile local: ${err.message}`);
            throw err;
        }
    }

    /**
     * Lấy danh sách profiles đang lưu dưới máy local và dung lượng.
     */
    async getLocalProfiles() {
        const { teamId, localProfilesPath } = getConfig();
        if (!teamId) return [];

        const basePath = path.join(localProfilesPath, teamId, teamId);
        try {
            const entries = await fs.readdir(basePath, { withFileTypes: true });
            const profiles = [];

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const profilePath = path.join(basePath, entry.name);
                    const size = await this._getDirSize(profilePath);
                    profiles.push({
                        id: entry.name,
                        size: size,
                        size_formatted: this._formatSize(size),
                        path: profilePath
                    });
                }
            }
            return profiles;
        } catch (err) {
            console.error(`[MLX] ❌ Lỗi khi quét folder local: ${err.message}`);
            return [];
        }
    }

    /**
     * Dọn dẹp tất cả folder profile local.
     */
    async clearLocalProfiles() {
        const { teamId, localProfilesPath } = getConfig();
        if (!teamId) throw new Error('Cấu hình MLX_TEAM_ID còn thiếu');

        const basePath = path.join(localProfilesPath, teamId, teamId);
        try {
            const entries = await fs.readdir(basePath, { withFileTypes: true });
            let deletedCount = 0;

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await fs.rm(path.join(basePath, entry.name), { recursive: true, force: true });
                    deletedCount++;
                }
            }
            console.log(`[MLX] ✅ Đã dọn dẹp ${deletedCount} folder profile local`);
            return deletedCount;
        } catch (err) {
            console.error(`[MLX] ❌ Lỗi dọn dẹp folder local: ${err.message}`);
            throw err;
        }
    }

    async _getDirSize(dirPath) {
        let size = 0;
        try {
            const files = await fs.readdir(dirPath, { withFileTypes: true });
            for (const file of files) {
                const filePath = path.join(dirPath, file.name);
                if (file.isDirectory()) {
                    size += await this._getDirSize(filePath);
                } else {
                    const stats = await fs.stat(filePath);
                    size += stats.size;
                }
            }
        } catch (e) { }
        return size;
    }

    _formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ─── STATUS ───────────────────────────────────────────────────────────────

    /**
     * Lấy danh sách profileId đang bị khoá (đang chạy bởi process khác).
     * @returns {Promise<string[]>}
     */
    async getLockedProfileIds() {
        try {
            const response = await this.api.get('/bpds/profile/locked_profile_ids');
            if (response.data?.status?.http_code === 200) {
                return response.data.data.ids || [];
            }
        } catch (err) {
            console.error(`[MLX] ❌ Không thể lấy locked profiles: ${err.message}`);
        }
        return [];
    }

    /**
     * Trạng thái profiles đang chạy (từ Launcher V1).
     * @returns {Promise<{ active_counter: object, states: object }>}
     */
    async getProfileStatuses() {
        try {
            const { launcherV1 } = getConfig();
            const response = await this.api.get(`${launcherV1}/profile/statuses`);
            if (response.data?.status?.http_code === 200) {
                return response.data.data || { active_counter: {}, states: {} };
            }
        } catch (err) {
            console.error(`[MLX] ❌ Không thể lấy trạng thái profile: ${err.message}`);
        }
        return { active_counter: {}, states: {} };
    }

    // ─── BATCH ────────────────────────────────────────────────────────────────

    /**
     * Xoá toàn bộ profiles trong một group (batch song song).
     * @param {string} groupId
     * @param {Function|null} onProgress - Callback(deletedSoFar, total)
     * @returns {Promise<number>} Tổng số profile đã xoá
     */
    async cleanupGroup(groupId, onProgress = null) {
        console.log(`[MLX] 🧹 Bắt đầu dọn dẹp group: ${groupId}`);
        const PAGE_SIZE = 300;
        let deletedTotal = 0;

        while (true) {
            // Fetch 5 trang song song, luôn offset=0 (profiles bị xoá từ đầu)
            const results = await Promise.all(
                Array(5).fill(null).map(() =>
                    this.searchProfiles(groupId, 0, PAGE_SIZE)
                        .catch(() => ({ profiles: [], total: 0 }))
                )
            );

            const allProfiles = results.flatMap((r) => r.profiles);
            const totalInGroup = results[0]?.total || 0;

            if (allProfiles.length === 0) {
                console.log(`[MLX] ✨ Group ${groupId} đã trống`);
                break;
            }

            const uniqueIds = [...new Set(allProfiles.map((p) => p.id))];

            // Chia batch 300 và xoá song song
            const batches = [];
            for (let i = 0; i < uniqueIds.length; i += PAGE_SIZE) {
                batches.push(uniqueIds.slice(i, i + PAGE_SIZE));
            }

            await Promise.all(batches.map((b) => this.removeProfile(b)));
            deletedTotal += uniqueIds.length;
            if (onProgress) onProgress(deletedTotal, totalInGroup);
            await this._delay(1000);
        }

        console.log(`[MLX] ✅ Đã xoá tổng cộng ${deletedTotal} profiles`);
        return deletedTotal;
    }

    /**
     * Kiểm tra trạng thái Agent MLX (Launcher)
     */
    async checkAgentStatus() {
        try {
            const { launcherV1 } = getConfig();
            const response = await axios.get(`${launcherV1}/version`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                },
                timeout: 2000
            });
            return response.data?.status?.http_code === 200;
        } catch (err) {
            return false;
        }
    }
}

// Singleton - dùng chung toàn bộ app
const mlx = new MLXService();
export default mlx;
export { MLXService };
