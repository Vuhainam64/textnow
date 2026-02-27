/**
 * server.js - Entry point của backend API
 * -----------------------------------------
 * Khởi chạy server Express, kết nối MongoDB,
 * đăng ký tất cả routes, và login MLX 1 lần.
 *
 * Cách chạy:
 *   npm run dev    → node --env-file=.env --watch src/server.js
 *   npm start      → node --env-file=.env src/server.js
 *
 * ⚠️  Biến môi trường được load bởi --env-file flag của Node (không cần dotenv)
 *     → đảm bảo process.env có mặt trước khi bất kỳ module nào được import.
 *
 * Biến môi trường cần thiết (xem .env.example):
 *   PORT         - Cổng server (mặc định: 3000)
 *   MONGODB_URI  - URI kết nối MongoDB
 *   MLX_USER     - Email đăng nhập MLX
 *   MLX_PASSWORD - Mật khẩu MLX
 *   MLX_HOST     - Base URL API MLX
 *   MLX_GROUP_ID - ID folder/group mặc định
 */

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/database.js';
import accountRoutes from './routes/accountRoutes.js';
import proxyRoutes from './routes/proxyRoutes.js';
import mlxRoutes from './routes/mlxRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import mlx from './services/mlxService.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/accounts', accountRoutes);
app.use('/api/proxies', proxyRoutes);
app.use('/api/mlx', mlxRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/workflows', workflowRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mlx: mlx.token ? 'authenticated' : 'not authenticated',
        timestamp: new Date().toISOString(),
    });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route không tồn tại' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error('❌ Global error:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
async function bootstrap() {
    // 1. Kết nối MongoDB
    await connectDB();

    // 2. Login MLX 1 lần duy nhất (giữ token cho suốt phiên chạy)
    try {
        await mlx.signin();
    } catch (err) {
        console.warn(`⚠️  Không thể login MLX lúc khởi động: ${err.message}`);
        console.warn('   → Sẽ thử lại khi có request đầu tiên đến /api/mlx/*');
    }

    // 3. Mở server
    app.listen(PORT, () => {
        console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    });
}

bootstrap();
