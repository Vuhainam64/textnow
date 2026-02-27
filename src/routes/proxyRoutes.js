/**
 * proxyRoutes.js - Routes quản lý proxy
 * ----------------------------------------
 * Cung cấp các API endpoint CRUD cho collection proxies.
 *
 * Endpoints:
 * GET    /api/proxies        - Lấy danh sách proxy (có lọc, phân trang)
 * POST   /api/proxies        - Thêm proxy mới
 * POST   /api/proxies/import - Nhập hàng loạt proxy
 * PUT    /api/proxies/:id    - Cập nhật proxy
 * DELETE /api/proxies/:id    - Xoá proxy
 * GET    /api/proxies/stats  - Thống kê proxy
 */

import express from 'express';
import Proxy from '../models/Proxy.js';

const router = express.Router();

// ─── GET /api/proxies ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { status, type, page = 1, limit = 20, search, group_id } = req.query;
        const query = {};

        if (status) query.status = status;
        if (type) query.type = type;
        if (group_id === 'null') query.group_id = null;
        else if (group_id) query.group_id = group_id;
        if (search) {
            query.$or = [
                { host: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
            ];
        }

        const total = await Proxy.countDocuments(query);
        const proxies = await Proxy.find(query)
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({
            success: true,
            data: proxies,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── GET /api/proxies/stats ──────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const stats = await Proxy.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const total = await Proxy.countDocuments();
        res.json({ success: true, data: { stats, total } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── POST /api/proxies ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const proxy = new Proxy(req.body);
        await proxy.save();
        res.status(201).json({ success: true, data: proxy });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Proxy đã tồn tại' });
        }
        res.status(400).json({ success: false, message: error.message });
    }
});

// ─── POST /api/proxies/import ────────────────────────────────────────────────
// Format nhập: "host:port:user:pass" hoặc mảng object JSON
router.post('/import', async (req, res) => {
    try {
        const { proxies, raw, group_id } = req.body;
        let proxyList = proxies;

        if (raw && typeof raw === 'string') {
            proxyList = raw
                .split('\n').map(l => l.trim()).filter(Boolean)
                .map(line => {
                    const [host, port, username, password] = line.split(':');
                    return { host, port: Number(port), username, password, type: 'http' };
                });
        }

        if (!Array.isArray(proxyList)) {
            return res.status(400).json({ success: false, message: 'proxies phải là mảng' });
        }

        const list = group_id ? proxyList.map(p => ({ ...p, group_id })) : proxyList;
        const result = await Proxy.insertMany(list, { ordered: false });
        res.status(201).json({ success: true, inserted: result.length });
    } catch (error) {
        const inserted = error.result?.nInserted ?? 0;
        res.status(207).json({ success: true, inserted, errors: error.message });
    }
});

// ─── PUT /api/proxies/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const proxy = await Proxy.findByIdAndUpdate(req.params.id, req.body, {
            returnDocument: 'after',
            runValidators: true,
        });
        if (!proxy) return res.status(404).json({ success: false, message: 'Không tìm thấy proxy' });
        res.json({ success: true, data: proxy });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// ─── DELETE /api/proxies/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const proxy = await Proxy.findByIdAndDelete(req.params.id);
        if (!proxy) return res.status(404).json({ success: false, message: 'Không tìm thấy proxy' });
        res.json({ success: true, message: 'Đã xoá proxy' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
