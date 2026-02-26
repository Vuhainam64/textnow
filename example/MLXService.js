import axios from 'axios';
import crypto from 'crypto';
import chalk from 'chalk';

export class MLXService {
    constructor(config) {
        this.config = {
            email: config.email,
            password: config.password,
            host: config.host || 'https://api-mult.mmovn.xyz',
            launcherV1: config.launcherV1 || 'https://launcher.mlx.yt:45001/api/v1',
            launcherV2: config.launcherV2 || 'https://launcher.mlx.yt:45001/api/v2',
            groupId: config.groupId,
            teamId: config.teamId
        };

        this.token = null;
        this.refreshToken = null;
        this.userInfo = null;

        // Create axios instance
        this.api = axios.create({
            baseURL: this.config.host,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000 // 30s timeout to prevent hanging
        });

        // Add interceptor to inject token
        this.api.interceptors.request.use((req) => {
            if (this.token) {
                req.headers['Authorization'] = `Bearer ${this.token}`;
            }
            return req;
        });
    }

    /**
     * Hash password using MD5 (Legacy requirement for MLX)
     */
    _hashPassword(password) {
        return crypto.createHash('md5').update(password).digest('hex');
    }

    /**
     * Sign in to MLX with retries and concurrent call protection
     */
    async signin(maxRetries = 5) {
        // If already signing in, wait for that promise
        if (this.signinPromise) return this.signinPromise;

        this.signinPromise = (async () => {
            console.log(chalk.blue('[MLX] 🔐 authenticating with MLX...'));

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const payload = {
                        email: this.config.email,
                        password: this._hashPassword(this.config.password)
                    };

                    const response = await this.api.post('/user/signin', payload);

                    if (response.data?.status?.http_code === 200) {
                        const { token, refresh_token, ...userData } = response.data.data;
                        this.token = token;
                        this.refreshToken = refresh_token;
                        this.userInfo = userData;

                        console.log(chalk.green('[MLX] ✅ MLX Login Successful'));
                        return true;
                    } else {
                        throw new Error(response.data?.status?.message || 'Unknown login error');
                    }

                } catch (error) {
                    const isNetworkError = !error.response;
                    const errorMsg = error.response?.data?.status?.message || error.message;

                    console.error(chalk.red(`[MLX] ❌ MLX Login Attempt ${attempt}/${maxRetries} Failed:`), errorMsg);

                    if (attempt === maxRetries) {
                        this.signinPromise = null;
                        throw error;
                    }

                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        })();

        const result = await this.signinPromise;
        this.signinPromise = null;
        return result;
    }

    /**
     * Get current auth token
     */
    getToken() {
        return this.token;
    }

    /**
     * Start a profile using MLX Launcher V2 (Playwright mode)
     */
    async startProfile(profileId) {
        console.log(chalk.blue(`[MLX] 🚀 Starting profile ${profileId}...`));
        try {
            // Ensure we are logged in
            if (!this.token) await this.signin();

            const url = `${this.config.launcherV2}/profile/f/${this.config.groupId}/p/${profileId}/start?automation_type=playwright`;
            // console.log(chalk.gray(`[DEBUG] Start URL: ${url}`));

            // Headers should be clean for launcher API
            const headers = {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            };

            const response = await axios.get(url, { headers });

            if (response.data?.status?.http_code === 200) {
                const port = response.data.data.port;
                console.log(chalk.green(`[MLX] Profile started on port ${port}`));
                return {
                    success: true,
                    port: port,
                    wsEndpoint: `ws://127.0.0.1:${port}`
                };
            } else {
                throw new Error(response.data?.status?.message || 'Failed to start profile');
            }
        } catch (error) {
            console.error(chalk.red(`[MLX] ❌ Failed to start profile ${profileId}:`), error.message);
            if (error.response?.data) {
                console.error(chalk.red(`[MLX] 🔍 Server Response:`), JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }

    /**
     * Stop a profile
     */
    async stopProfile(profileId) {
        if (!this.token) await this.signin();
        const url = `${this.config.launcherV1}/profile/stop/p/${profileId}`;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(chalk.blue(`[MLX] 🛑 Stopping profile ${profileId} (Attempt ${attempt}/3)...`));
                await this.api.get(url);
                console.log(chalk.green(`[MLX] ✅ Profile ${profileId} stopped signal sent`));
                return;
            } catch (error) {
                console.warn(chalk.yellow(`[MLX] ⚠️ Attempt ${attempt} failed to stop profile ${profileId}:`), error.message);
                if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
                else console.warn(chalk.red(`[MLX] ❌ Failed to stop profile ${profileId} after 3 attempts`));
            }
        }
    }

    /**
     * Get IDs of profiles strictly locked by other running processes
     */
    async getLockedProfileIds() {
        try {
            if (!this.token) await this.signin();

            const response = await this.api.get('/bpds/profile/locked_profile_ids');

            if (response.data?.status?.http_code === 200) {
                return response.data.data.ids || [];
            }
            return [];
        } catch (error) {
            console.error(chalk.red('[MLX] ❌ Failed to get locked profile IDs:'), error.message);
            return [];
        }
    }

    /**
     * Search profiles in a folder/group
     */
    async searchProfiles(groupId, offset = 0, limit = 50) {
        try {
            if (!this.token) await this.signin();

            const payload = {
                folder_id: groupId,
                offset,
                limit,
                search_text: "",
                storage_type: "all",
                browser_type: null,
                os_type: null,
                is_removed: false,
                order_by: "created_at",
                sort: "desc"
            };

            const response = await this.api.post('/profile/search', payload);

            if (response.data?.status?.http_code === 200) {
                return {
                    profiles: response.data.data.profiles || [],
                    total: response.data.data.total_count || 0
                };
            }
            return { profiles: [], total: 0 };
        } catch (error) {
            console.error(chalk.red('[MLX] ❌ Search Failed:'), error.message);
            return { profiles: [], total: 0 };
        }
    }

    /**
     * Fully clear a group (batch delete 300 profiles, 5 parallel threads)
     */
    async cleanupGroup(groupId, onProgress = null) {
        console.log(chalk.magenta(`[MLX] 🧹 Starting cleanup for Group: ${groupId}`));
        let deletedTotal = 0;

        try {
            while (true) {
                // 1. Fetch 5 pages of 300 profiles in parallel (1500 profiles per round)
                const PAGE_SIZE = 300;
                const PARALLEL_PAGES = 5;

                const searchTasks = [];
                for (let i = 0; i < PARALLEL_PAGES; i++) {
                    // We always fetch offset 0 because profiles are being deleted from the top
                    searchTasks.push(this.searchProfiles(groupId, 0, PAGE_SIZE));
                }

                const results = await Promise.all(searchTasks);
                const allProfiles = results.flatMap(r => r.profiles);
                const totalInGroup = results[0]?.total || 0;

                if (allProfiles.length === 0) {
                    console.log(chalk.green(`[MLX] ✨ Group ${groupId} is now empty.`));
                    break;
                }

                // Unique profiles only (just in case of overlap during search)
                const uniqueIds = [...new Set(allProfiles.map(p => p.id))];

                // 2. Delete in batches of 300 (parallelized)
                const deleteChunks = [];
                for (let i = 0; i < uniqueIds.length; i += PAGE_SIZE) {
                    deleteChunks.push(uniqueIds.slice(i, i + PAGE_SIZE));
                }

                console.log(chalk.gray(`[MLX] 🗑️ Deleting ${uniqueIds.length} profiles in ${deleteChunks.length} parallel requests...`));

                const deleteTasks = deleteChunks.map(chunk => this.removeProfile(chunk));
                await Promise.all(deleteTasks);

                deletedTotal += uniqueIds.length;
                if (onProgress) onProgress(deletedTotal, totalInGroup);

                // Small delay to prevent rate limit
                await new Promise(r => setTimeout(r, 1000));
            }

            return deletedTotal;
        } catch (error) {
            console.error(chalk.red(`[MLX] ❌ Cleanup failed after ${deletedTotal} deletes:`), error.message);
            throw error;
        }
    }

    /**
     * Create a new MLX Profile
     */
    async createProfile(name, proxy = null) {
        console.log(chalk.blue(`[MLX] 🛠️ Creating profile "${name}"...`));
        try {
            if (!this.token) await this.signin();

            // Default payload structure based on user curl
            const payload = {
                browser_type: "mimic",
                folder_id: this.config.groupId,
                name: name,
                os_type: "windows",
                parameters: {
                    fingerprint: {
                        // cmd_params: {
                        //     params: [{ "flag": "headless", "value": "new" }] // Run headless by default for automation
                        // },
                        // screen: { "width": 1920, "height": 1080, "pixel_ratio": 1 }
                    },
                    flags: {
                        navigator_masking: "mask",
                        audio_masking: "mask",
                        localization_masking: "mask",
                        geolocation_popup: "prompt",
                        geolocation_masking: "mask",
                        timezone_masking: "mask",
                        graphics_noise: "mask",
                        graphics_masking: "mask",
                        webrtc_masking: "disabled",
                        fonts_masking: "mask",
                        media_devices_masking: "mask",
                        screen_masking: "mask",
                        proxy_masking: proxy ? "custom" : "disabled",
                        ports_masking: "mask",
                        canvas_noise: "mask",
                        startup_behavior: "custom"
                    },
                    storage: {
                        is_local: true,
                        save_service_worker: null
                    }
                }
            };

            // Add Proxy if provided
            if (proxy) {
                payload.parameters.proxy = {
                    type: proxy.type || "socks5",
                    host: proxy.host,
                    port: parseInt(proxy.port)
                };

                if (proxy.username) payload.parameters.proxy.username = proxy.username;
                if (proxy.password) payload.parameters.proxy.password = proxy.password;
            }

            const response = await this.api.post('/profile/create', payload);
            if (response.data?.status?.http_code === 201) {
                const profileId = response.data.data.ids[0];
                console.log(chalk.green(`✅ Profile Created: ${profileId}`));
                return profileId;
            } else {
                throw new Error(response.data?.status?.message || 'Create profile failed');
            }
        } catch (error) {
            console.error(chalk.red('❌ Failed to create profile:'), error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Remove profile(s)
     * @param {string|string[]} profileIds - Profile ID or array of Profile IDs
     */
    async removeProfile(profileIds) {
        console.log(chalk.blue(`[MLX] 🗑️ Removing profile(s): ${profileIds}...`));
        try {
            if (!this.token) await this.signin();

            const ids = Array.isArray(profileIds) ? profileIds : [profileIds];

            const payload = {
                ids: ids,
                permanently: true
            };

            const response = await this.api.post('/profile/remove', payload);

            if (response.data?.status?.http_code === 200) {
                console.log(chalk.green('[MLX] ✅ Profile removed successfully'));
                return true;
            } else {
                throw new Error(response.data?.status?.message || 'Failed to remove profile');
            }

        } catch (error) {
            console.error(chalk.red('[MLX] ❌ Error removing profile:'), error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get statuses of running profiles
     */
    async getProfileStatuses() {
        try {
            if (!this.token) await this.signin();

            // Statuses endpoint is on Launcher V1
            const url = `${this.config.launcherV1}/profile/statuses`;

            const response = await this.api.get(url);

            if (response.data?.status?.http_code === 200) {
                // console.log(chalk.gray(`[DEBUG] MLX Status: ${JSON.stringify(response.data.data)}`));
                return response.data.data || { active_counter: {}, states: {} };
            }
            return { active_counter: {}, states: {} };

        } catch (error) {
            console.error(chalk.red('[MLX] ❌ Failed to get profile statuses:'), error.message);
            return { active_counter: {}, states: {} };
        }
    }
}
