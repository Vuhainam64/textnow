/**
 * serverStore.js
 * 
 * Quản lý danh sách VPS server và server đang active.
 * Lưu vào localStorage để persist giữa các session.
 * 
 * Logic ưu tiên:
 *  - Development (npm run dev): luôn dùng '/api' (Vite proxy → localhost)
 *    trừ khi user đã chủ động switch sang server khác trong session này.
 *  - Production: dùng active server từ localStorage (hoặc VITE_API_URL).
 */

const STORAGE_KEY = 'vps_servers'
const ACTIVE_KEY = 'vps_active'

const IS_DEV = import.meta.env.DEV

// Server mặc định: dev dùng Vite proxy, production dùng VITE_API_URL
const DEFAULT_SERVERS = [
    {
        id: 'local',
        name: IS_DEV ? 'Local Dev' : 'Production',
        url: IS_DEV ? '/api' : (import.meta.env.VITE_API_URL || '/api'),
        color: IS_DEV ? '#6366f1' : '#10b981',
        icon: IS_DEV ? '�' : '🚀',
    },
]

/**
 * ID của server được user chủ động switch trong session hiện tại.
 * Chỉ tồn tại trong sessionStorage (reset khi đóng tab).
 * Ưu tiên cao hơn localStorage để dev mode không bị ảnh hưởng bởi
 * localStorage từ production.
 */
const SESSION_ACTIVE_KEY = 'vps_active_session'

/**
 * Đọc danh sách servers từ localStorage
 */
export function getServers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return DEFAULT_SERVERS
        const list = JSON.parse(raw)
        return list.length > 0 ? list : DEFAULT_SERVERS
    } catch {
        return DEFAULT_SERVERS
    }
}

/**
 * Lưu danh sách servers
 */
export function saveServers(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

/**
 * Lấy active server ID.
 * - Trong dev: ưu tiên sessionStorage (user chủ động chọn trong tab này)
 *              fallback về 'local' (Local Dev / api)
 * - Trong prod: ưu tiên localStorage, fallback về server đầu tiên
 */
export function getActiveServerId() {
    if (IS_DEV) {
        // Chỉ dùng selection của user nếu họ đã chủ động switch trong tab này
        const sessionChoice = sessionStorage.getItem(SESSION_ACTIVE_KEY)
        if (sessionChoice) return sessionChoice
        // Default dev: luôn là 'local'
        return 'local'
    }
    return localStorage.getItem(ACTIVE_KEY) || getServers()[0]?.id
}

/**
 * Set active server (user chủ động chọn)
 */
export function setActiveServerId(id) {
    localStorage.setItem(ACTIVE_KEY, id)
    // Ghi vào sessionStorage để dev mode biết user đã chủ động switch
    sessionStorage.setItem(SESSION_ACTIVE_KEY, id)
}

/**
 * Lấy active server object
 */
export function getActiveServer() {
    const id = getActiveServerId()
    const servers = getServers()
    return servers.find(s => s.id === id) || servers[0]
}

/**
 * Lấy base URL của active server.
 *
 * Dev mode:
 *  - Nếu user CHƯA chủ động switch server trong tab này → trả ngay '/api' (Vite proxy)
 *    KHÔNG đọc localStorage vì localStorage có thể chứa URL Vercel từ production.
 *  - Nếu user ĐÃ switch → dùng URL của server đó.
 *
 * Production:
 *  - Đọc từ localStorage như bình thường.
 */
export function getActiveBaseUrl() {
    if (IS_DEV && !sessionStorage.getItem(SESSION_ACTIVE_KEY)) {
        return '/api'
    }
    const server = getActiveServer()
    return server?.url || (IS_DEV ? '/api' : (import.meta.env.VITE_API_URL || '/api'))
}
