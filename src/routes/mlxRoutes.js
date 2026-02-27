/**
 * mlxRoutes.js - Proxy API cho MLX (Multilogin X)
 * -------------------------------------------------
 * Frontend không gọi thẳng MLX server (CORS, token bảo mật).
 * Backend relay các request qua mlxService và trả về kết quả.
 *
 * ⚠️  Auth: mlx.signin() được gọi 1 lần duy nhất lúc server khởi động
 * (trong server.js), KHÔNG gọi lại trong middleware ở đây.
 *
 * Endpoints:
 * GET  /api/mlx/folders             - Danh sách folders/groups
 * PUT  /api/mlx/folders             - Cập nhật folder
 * POST /api/mlx/folders/cleanup     - Xoá toàn bộ profiles trong folder
 * POST /api/mlx/profiles/search     - Tìm kiếm profiles
 * POST /api/mlx/profiles/remove     - Xoá profiles
 * GET  /api/mlx/profiles/locked     - Profile IDs đang bị khoá
 * GET  /api/mlx/profiles/statuses   - Trạng thái profiles đang chạy
 * POST /api/mlx/profiles/create     - Tạo profile mới
 */

import express from 'express';
import mlx from '../services/mlxService.js';

const router = express.Router();

// ─── Folders / Groups ────────────────────────────────────────────────────────

/**
 * GET /api/mlx/folders
 * Lấy danh sách folders từ MLX workspace.
 * Response: { success, data: [...folders] }
 */
router.get('/folders', async (req, res) => {
    try {
        const folders = await mlx.getFolders();
        res.json({ success: true, data: folders });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/mlx/folders
 * Tạo folder mới.
 * Body: { name, comment? }
 */
router.post('/folders', async (req, res) => {
    try {
        const { name, comment = '' } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: 'name là bắt buộc' });
        const id = await mlx.createFolder(name.trim(), comment);
        res.status(201).json({ success: true, data: { id } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/mlx/folders
 * Cập nhật folder (tên, comment).
 * Body: toàn bộ folder object { folder_id, name, comment, created_at, profiles_count }
 */
router.put('/folders', async (req, res) => {
    try {
        const ok = await mlx.updateFolder(req.body);
        res.json({ success: ok, message: ok ? 'Cập nhật thành công' : 'Cập nhật thất bại' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/mlx/folders
 * Xoá một hoặc nhiều folder.
 * Body: { ids: string[] }
 */
router.delete('/folders', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids phải là mảng không rỗng' });
        }
        const ok = await mlx.removeFolder(ids);
        res.json({ success: ok, message: ok ? `Đã xoá ${ids.length} folder` : 'Xoá thất bại' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/mlx/folders/cleanup
 * Xoá toàn bộ profiles trong folder (chạy ngầm).
 * Body: { folder_id }
 */
router.post('/folders/cleanup', async (req, res) => {
    try {
        const { folder_id } = req.body;
        if (!folder_id) return res.status(400).json({ success: false, message: 'folder_id là bắt buộc' });

        // Chạy ngầm, không block response
        mlx.cleanupGroup(folder_id).catch((err) =>
            console.error(`[MLX] Cleanup group ${folder_id} lỗi:`, err.message)
        );
        res.json({ success: true, message: 'Đang xoá toàn bộ profiles, kiểm tra log server để theo dõi' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── Profiles ────────────────────────────────────────────────────────────────

/**
 * POST /api/mlx/profiles/search
 * Tìm kiếm profiles trong group mặc định (từ MLX_GROUP_ID).
 * Body: { offset, limit, search_text, storage_type, is_removed, order_by, sort }
 */
router.post('/profiles/search', async (req, res) => {
    try {
        const {
            offset = 0,
            limit = 15,
            search_text = '',
            storage_type = 'all',
            is_removed = false,
            order_by = 'created_at',
            sort = 'desc',
        } = req.body;

        const groupId = process.env.MLX_GROUP_ID;
        if (!groupId) return res.status(500).json({ success: false, message: 'MLX_GROUP_ID chưa được cấu hình' });

        const result = await mlx.api.post('/profile/search', {
            folder_id: groupId,
            offset,
            limit,
            search_text,
            storage_type,
            browser_type: null,
            os_type: null,
            is_removed,
            order_by,
            sort,
        });

        if (result.data?.status?.http_code === 200) {
            return res.json({
                success: true,
                data: {
                    profiles: result.data.data.profiles || [],
                    total_count: result.data.data.total_count || 0,
                },
            });
        }
        res.json({ success: false, message: result.data?.status?.message });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/mlx/profiles/remove
 * Xoá 1 hoặc nhiều profile.
 * Body: { ids: string[] }
 */
router.post('/profiles/remove', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids phải là mảng không rỗng' });
        }
        await mlx.removeProfile(ids);
        res.json({ success: true, message: `Đã xoá ${ids.length} profile` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/mlx/profiles/locked
 * Lấy danh sách profile IDs đang bị khoá.
 */
router.get('/profiles/locked', async (req, res) => {
    try {
        const ids = await mlx.getLockedProfileIds();
        res.json({ success: true, data: ids });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/mlx/profiles/statuses
 * Trạng thái profiles đang chạy.
 */
router.get('/profiles/statuses', async (req, res) => {
    try {
        const data = await mlx.getProfileStatuses();
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/mlx/profiles/create
 * Tạo profile mới.
 * Body: { name, proxy? }
 */
router.post('/profiles/create', async (req, res) => {
    try {
        const { name, proxy } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'name là bắt buộc' });
        const profileId = await mlx.createProfile(name, proxy || null);
        res.status(201).json({ success: true, data: { id: profileId } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/mlx/agent/status
 * Kiểm tra xem Agent MLX đã bật chưa.
 */
router.get('/agent/status', async (req, res) => {
    try {
        const isConnected = await mlx.checkAgentStatus();
        res.json({ success: true, connected: isConnected });
    } catch (err) {
        res.json({ success: true, connected: false });
    }
});

export default router;
