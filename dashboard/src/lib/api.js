/**
 * api.js - Axios instance cấu hình sẵn
 * Tất cả requests tới /api/* sẽ qua proxy Vite → localhost:3000
 */
import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 30000,
})

// Response interceptor - chuẩn hóa lỗi
api.interceptors.response.use(
    (res) => res.data,
    (err) => {
        const msg = err?.response?.data?.message || err.message || 'Lỗi không xác định'
        return Promise.reject(new Error(msg))
    }
)

export default api
