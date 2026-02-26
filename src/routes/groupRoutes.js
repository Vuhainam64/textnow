/**
 * groupRoutes.js - Routes quản lý nhóm tài khoản và proxy
 * ---------------------------------------------------------
 * Endpoints accounts:
 * GET    /api/groups/accounts              - Lấy tất cả nhóm (kèm count)
 * POST   /api/groups/accounts              - Tạo nhóm mới
 * PUT    /api/groups/accounts/:id          - Cập nhật nhóm
 * DELETE /api/groups/accounts/:id          - Xoá nhóm
 *   ?deleteAccounts=true                     → xoá luôn tài khoản trong nhóm
 *   (mặc định)                              → tài khoản về ungrouped
 * DELETE /api/groups/accounts/:id/members  - Xoá toàn bộ accounts trong nhóm (giữ nhóm)
 * POST   /api/groups/accounts/assign       - Chuyển N accounts ungrouped → nhóm
 *
 * Endpoints proxies: tương tự
 */

import express from 'express';
import AccountGroup from '../models/AccountGroup.js';
import ProxyGroup from '../models/ProxyGroup.js';
import Account from '../models/Account.js';
import Proxy from '../models/Proxy.js';

const router = express.Router();

// ─── ACCOUNT GROUPS ──────────────────────────────────────────────────────────

/** GET /api/groups/accounts */
router.get('/accounts', async (req, res) => {
    try {
        const groups = await AccountGroup.find().sort({ created_at: -1 }).lean();
        const counts = await Promise.all(groups.map(g => Account.countDocuments({ group_id: g._id })));
        const ungroupedCount = await Account.countDocuments({ group_id: null });
        const result = groups.map((g, i) => ({ ...g, account_count: counts[i] }));
        res.json({ success: true, data: result, ungrouped_count: ungroupedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/** POST /api/groups/accounts — tạo nhóm mới */
router.post('/accounts', async (req, res) => {
    try {
        const { name, description = '', color } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: 'name là bắt buộc' });
        const group = await AccountGroup.create({ name: name.trim(), description, color });
        res.status(201).json({ success: true, data: group });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: 'Tên nhóm đã tồn tại' });
        res.status(400).json({ success: false, message: err.message });
    }
});

/** POST /api/groups/accounts/assign — chuyển N accounts ungrouped vào nhóm cụ thể */
router.post('/accounts/assign', async (req, res) => {
    try {
        const { group_id, count } = req.body;
        if (!group_id) return res.status(400).json({ success: false, message: 'group_id là bắt buộc' });

        // Tìm N accounts ungrouped (sắp xếp theo created_at cũ nhất trước)
        const limit = count ? Number(count) : undefined;
        const query = Account.find({ group_id: null }).sort({ created_at: 1 });
        if (limit) query.limit(limit);
        const accounts = await query.select('_id').lean();

        if (accounts.length === 0) return res.json({ success: true, updated: 0, message: 'Không có tài khoản nào chưa có nhóm' });

        const ids = accounts.map(a => a._id);
        const result = await Account.updateMany({ _id: { $in: ids } }, { $set: { group_id } });
        res.json({ success: true, updated: result.modifiedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/** PUT /api/groups/accounts/:id */
router.put('/accounts/:id', async (req, res) => {
    try {
        const { name, description, color } = req.body;
        const group = await AccountGroup.findByIdAndUpdate(
            req.params.id, { name, description, color }, { new: true, runValidators: true }
        );
        if (!group) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
        res.json({ success: true, data: group });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: 'Tên nhóm đã tồn tại' });
        res.status(400).json({ success: false, message: err.message });
    }
});

/** DELETE /api/groups/accounts/:id/members — xoá toàn bộ accounts trong nhóm, giữ nhóm */
router.delete('/accounts/:id/members', async (req, res) => {
    try {
        const group = await AccountGroup.findById(req.params.id).lean();
        if (!group) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
        const result = await Account.deleteMany({ group_id: req.params.id });
        res.json({ success: true, deleted: result.deletedCount, message: `Đã xoá ${result.deletedCount} tài khoản trong nhóm "${group.name}"` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/** DELETE /api/groups/accounts/:id
 *  ?deleteAccounts=true  → xoá nhóm + xoá luôn tất cả accounts trong nhóm
 *  (mặc định)            → xoá nhóm, accounts về ungrouped
 */
router.delete('/accounts/:id', async (req, res) => {
    try {
        const { deleteAccounts } = req.query;
        const group = await AccountGroup.findByIdAndDelete(req.params.id);
        if (!group) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });

        let deletedAccounts = 0;
        if (deleteAccounts === 'true') {
            const result = await Account.deleteMany({ group_id: req.params.id });
            deletedAccounts = result.deletedCount;
        } else {
            await Account.updateMany({ group_id: req.params.id }, { $set: { group_id: null } });
        }

        res.json({ success: true, message: `Đã xoá nhóm "${group.name}"`, deleted_accounts: deletedAccounts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PROXY GROUPS ─────────────────────────────────────────────────────────────

/** GET /api/groups/proxies */
router.get('/proxies', async (req, res) => {
    try {
        const groups = await ProxyGroup.find().sort({ created_at: -1 }).lean();
        const counts = await Promise.all(groups.map(g => Proxy.countDocuments({ group_id: g._id })));
        const ungroupedCount = await Proxy.countDocuments({ group_id: null });
        const result = groups.map((g, i) => ({ ...g, proxy_count: counts[i] }));
        res.json({ success: true, data: result, ungrouped_count: ungroupedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/** POST /api/groups/proxies — tạo nhóm proxy mới */
router.post('/proxies', async (req, res) => {
    try {
        const { name, description = '', color } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: 'name là bắt buộc' });
        const group = await ProxyGroup.create({ name: name.trim(), description, color });
        res.status(201).json({ success: true, data: group });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: 'Tên nhóm đã tồn tại' });
        res.status(400).json({ success: false, message: err.message });
    }
});

/** POST /api/groups/proxies/assign — chuyển N proxies ungrouped vào nhóm */
router.post('/proxies/assign', async (req, res) => {
    try {
        const { group_id, count } = req.body;
        if (!group_id) return res.status(400).json({ success: false, message: 'group_id là bắt buộc' });
        const limit = count ? Number(count) : undefined;
        const query = Proxy.find({ group_id: null }).sort({ created_at: 1 });
        if (limit) query.limit(limit);
        const proxies = await query.select('_id').lean();
        if (proxies.length === 0) return res.json({ success: true, updated: 0, message: 'Không có proxy nào chưa có nhóm' });
        const ids = proxies.map(p => p._id);
        const result = await Proxy.updateMany({ _id: { $in: ids } }, { $set: { group_id } });
        res.json({ success: true, updated: result.modifiedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/** PUT /api/groups/proxies/:id */
router.put('/proxies/:id', async (req, res) => {
    try {
        const { name, description, color } = req.body;
        const group = await ProxyGroup.findByIdAndUpdate(
            req.params.id, { name, description, color }, { new: true, runValidators: true }
        );
        if (!group) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
        res.json({ success: true, data: group });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: 'Tên nhóm đã tồn tại' });
        res.status(400).json({ success: false, message: err.message });
    }
});

/** DELETE /api/groups/proxies/:id/members — xoá toàn bộ proxies trong nhóm */
router.delete('/proxies/:id/members', async (req, res) => {
    try {
        const group = await ProxyGroup.findById(req.params.id).lean();
        if (!group) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
        const result = await Proxy.deleteMany({ group_id: req.params.id });
        res.json({ success: true, deleted: result.deletedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/** DELETE /api/groups/proxies/:id */
router.delete('/proxies/:id', async (req, res) => {
    try {
        const { deleteProxies } = req.query;
        const group = await ProxyGroup.findByIdAndDelete(req.params.id);
        if (!group) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
        let deletedProxies = 0;
        if (deleteProxies === 'true') {
            const result = await Proxy.deleteMany({ group_id: req.params.id });
            deletedProxies = result.deletedCount;
        } else {
            await Proxy.updateMany({ group_id: req.params.id }, { $set: { group_id: null } });
        }
        res.json({ success: true, message: `Đã xoá nhóm "${group.name}"`, deleted_proxies: deletedProxies });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
