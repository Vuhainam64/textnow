/**
 * accountRoutes.js - Routes quản lý tài khoản
 * ---------------------------------------------
 * Cung cấp các API endpoint CRUD cho collection accounts.
 *
 * Endpoints:
 * GET    /api/accounts          - Lấy danh sách tài khoản (có phân trang, lọc)
 * GET    /api/accounts/:id      - Lấy chi tiết 1 tài khoản
 * POST   /api/accounts          - Tạo tài khoản mới
 * PUT    /api/accounts/:id      - Cập nhật tài khoản
 * DELETE /api/accounts/:id      - Xoá tài khoản
 * POST   /api/accounts/import   - Nhập hàng loạt từ mảng JSON
 * GET    /api/accounts/stats    - Thống kê tài khoản theo trạng thái
 */

import express from 'express';
import mongoose from 'mongoose';
import Account from '../models/Account.js';

const router = express.Router();

// ─── GET /api/accounts ───────────────────────────────────────────────────────
// Trả về danh sách tài khoản, hỗ trợ lọc theo status và phân trang
router.get('/', async (req, res) => {
    try {
        const { status, page = 1, limit = 20, search, group_id } = req.query;
        const query = {};

        if (status) query.status = status;
        if (group_id === 'null') query.group_id = null;          // accounts chưa có nhóm
        else if (group_id) query.group_id = group_id;      // accounts thuộc nhóm cụ thể
        if (search) {
            query.$or = [
                { textnow_user: { $regex: search, $options: 'i' } },
                { hotmail_user: { $regex: search, $options: 'i' } },
            ];
        }

        const total = await Account.countDocuments(query);
        const accounts = await Account.find(query)
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({
            success: true,
            data: accounts,
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

// ─── GET /api/accounts/stats ─────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const { group_id } = req.query;
        const match = {};
        if (group_id === 'null') match.group_id = null;
        else if (group_id && mongoose.Types.ObjectId.isValid(group_id)) {
            match.group_id = new mongoose.Types.ObjectId(group_id);
        }

        const stats = await Account.aggregate([
            { $match: match },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const total = await Account.countDocuments(match);
        res.json({ success: true, data: { stats, total } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── GET /api/accounts/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const account = await Account.findById(req.params.id);
        if (!account) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        res.json({ success: true, data: account });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── POST /api/accounts ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const account = new Account(req.body);
        await account.save();
        res.status(201).json({ success: true, data: account });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Tài khoản đã tồn tại' });
        }
        res.status(400).json({ success: false, message: error.message });
    }
});

// ─── POST /api/accounts/import ───────────────────────────────────────────────
// Nhập hàng loạt tài khoản, bỏ qua lỗi trùng lặp
router.post('/import', async (req, res) => {
    try {
        const { accounts, group_id } = req.body;
        if (!Array.isArray(accounts)) {
            return res.status(400).json({ success: false, message: 'accounts phải là mảng' });
        }
        // Gán group_id nếu được cung cấp
        const list = group_id ? accounts.map(a => ({ ...a, group_id })) : accounts;
        const result = await Account.insertMany(list, { ordered: false });
        res.status(201).json({ success: true, inserted: result.length });
    } catch (error) {
        const inserted = error.result?.nInserted ?? 0;
        res.status(207).json({ success: true, inserted, errors: error.message });
    }
});

// ─── PUT /api/accounts/:id ───────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const account = await Account.findByIdAndUpdate(req.params.id, req.body, {
            returnDocument: 'after',
            runValidators: true,
        });
        if (!account) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        res.json({ success: true, data: account });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// ─── DELETE /api/accounts/bulk ──────────────────────────────────────────────
router.delete('/bulk', async (req, res) => {
    try {
        const { status, search, group_id } = req.query;
        const query = {};

        if (status) query.status = status;
        if (group_id === 'null') query.group_id = null;
        else if (group_id) query.group_id = group_id;
        if (search) {
            query.$or = [
                { textnow_user: { $regex: search, $options: 'i' } },
                { hotmail_user: { $regex: search, $options: 'i' } },
            ];
        }

        const result = await Account.deleteMany(query);
        res.json({ success: true, message: ` Đã xoá ${result.deletedCount} tài khoản`, deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── DELETE /api/accounts/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const account = await Account.findByIdAndDelete(req.params.id);
        if (!account) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        res.json({ success: true, message: 'Đã xoá tài khoản' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── POST /api/accounts/export ──────────────────────────────────────────────
// Body: { status?, group_id?, deleteAfter?, format? }
// format: 'pipe6' (default) = tn_user|tn_pass|hm_user|hm_pass|hm_token|client_id
router.post('/export', async (req, res) => {
    try {
        const { status, group_id, deleteAfter = false } = req.body;
        const query = {};

        if (status) query.status = Array.isArray(status) ? { $in: status } : status;
        if (group_id === 'null') query.group_id = null;
        else if (group_id) query.group_id = group_id;

        const accounts = await Account.find(query).lean();

        // Format: tn_user|tn_pass|hm_user|hm_pass|hm_token|client_id
        const lines = accounts.map(a =>
            [
                a.textnow_user || '',
                a.textnow_pass || '',
                a.hotmail_user || '',
                a.hotmail_pass || '',
                a.hotmail_token || '',
                a.hotmail_client_id || '',
            ].join('|')
        ).join('\n');

        if (deleteAfter) {
            await Account.deleteMany(query);
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="accounts_${status || 'all'}_${Date.now()}.txt"`);
        res.send(lines);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
