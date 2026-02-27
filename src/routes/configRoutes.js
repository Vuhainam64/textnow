import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// GET /api/config/env - Lấy nội dung file .env
router.get('/env', async (req, res) => {
    try {
        const envPath = path.join(process.cwd(), '.env');
        const content = await fs.readFile(envPath, 'utf-8');
        res.json({ success: true, content });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Không thể đọc file .env: ' + error.message });
    }
});

// POST /api/config/env - Cập nhật nội dung file .env
router.post('/env', async (req, res) => {
    try {
        const { content } = req.body;
        if (typeof content !== 'string') {
            return res.status(400).json({ success: false, message: 'Nội dung không hợp lệ' });
        }

        const envPath = path.join(process.cwd(), '.env');
        await fs.writeFile(envPath, content, 'utf-8');

        res.json({ success: true, message: 'Đã cập nhật file .env. Vui lòng khởi động lại server để áp dụng thay đổi.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Không thể ghi file .env: ' + error.message });
    }
});

export default router;
