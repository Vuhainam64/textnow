/**
 * database.js
 * -----------
 * Kết nối tới MongoDB sử dụng Mongoose.
 * Hỗ trợ retry tự động khi kết nối thất bại.
 *
 * Sử dụng biến môi trường MONGODB_URI từ file .env
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/textnow';

/**
 * Kết nối tới MongoDB
 * @returns {Promise<void>}
 */
export async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 10, // Tối đa 10 kết nối đồng thời trong pool
        });
        console.log(`✅ MongoDB đã kết nối: ${MONGODB_URI}`);
    } catch (error) {
        console.error('❌ Lỗi kết nối MongoDB:', error.message);
        // Thử lại sau 5 giây
        setTimeout(connectDB, 5000);
    }
}

// Lắng nghe sự kiện ngắt kết nối
mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB bị ngắt kết nối, đang thử kết nối lại...');
    setTimeout(connectDB, 5000);
});

export default mongoose;
