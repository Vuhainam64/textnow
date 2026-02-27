import express from 'express';
import Account from '../models/Account.js';
import Proxy from '../models/Proxy.js';

const router = express.Router();

/**
 * @route   POST /api/tasks/run
 * @desc    Khởi chạy một loại task cụ thể
 */
router.post('/run', async (req, res) => {
    try {
        const { type, config } = req.body;

        console.log(`[Task] 🚀 Yêu cầu chạy task: ${type}`);
        console.log(`[Task] ⚙️ Cấu hình:`, config);

        // TODO: Khởi tạo service tương ứng và đưa vào hàng đợi

        // Demo: Tìm số lượng tài khoản thoả mãn
        const query = { group_id: config.account_group_id };
        if (config.target_statuses?.length > 0) {
            query.status = { $in: config.target_statuses };
        }

        const count = await Account.countDocuments(query);

        res.json({
            success: true,
            message: `Đã nhận yêu cầu chạy task ${type}`,
            estimate_accounts: count
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/tasks/status
 * @desc    Lấy trạng thái các task đang chạy
 */
router.get('/status', (req, res) => {
    res.json({
        running: 0,
        pending: 0,
        completed_today: 0
    });
});

export default router;
