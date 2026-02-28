/**
 * api.js - Axios instance với dynamic base URL
 * Base URL được lấy từ active VPS server (localStorage)
 */
import axios from 'axios'
import { getActiveBaseUrl } from './serverStore'

const api = axios.create({
    timeout: 30000,
})

// Request interceptor: inject base URL của server đang active
// Mỗi request sẽ tự pick up URL mới khi user switch server
api.interceptors.request.use((config) => {
    config.baseURL = getActiveBaseUrl()
    return config
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
