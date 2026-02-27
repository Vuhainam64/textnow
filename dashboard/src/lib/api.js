/**
 * api.js - Axios instance cấu hình sẵn
 *
 * Development: Vite proxy /api → localhost:3000  (vite.config.js)
 * Production:  VITE_API_URL phải trỏ đến backend URL
 *              Ví dụ: VITE_API_URL=https://your-backend.onrender.com/api
 *
 * Set biến môi trường trên Vercel Dashboard:
 *   VITE_API_URL = https://your-backend.onrender.com/api
 */
import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 30000,
})

// Response interceptor - chuẩn hóa lỗi, unwrap data
api.interceptors.response.use(
    (res) => res.data,
    (err) => {
        const msg = err?.response?.data?.message || err.message || 'Lỗi không xác định'
        return Promise.reject(new Error(msg))
    }
)

export default api
