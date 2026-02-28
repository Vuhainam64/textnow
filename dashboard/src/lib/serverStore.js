/**
 * serverStore.js
 * 
 * Quản lý danh sách VPS server và server đang active.
 * Lưu vào localStorage để persist giữa các session.
 */

const STORAGE_KEY = 'vps_servers'
const ACTIVE_KEY = 'vps_active'

const DEFAULT_SERVERS = [
    {
        id: 'local',
        name: 'Local Dev',
        url: import.meta.env.VITE_API_URL || '/api',
        color: '#6366f1',
        icon: '🖥️',
    },
]

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
 * Lấy active server ID
 */
export function getActiveServerId() {
    return localStorage.getItem(ACTIVE_KEY) || getServers()[0]?.id
}

/**
 * Set active server
 */
export function setActiveServerId(id) {
    localStorage.setItem(ACTIVE_KEY, id)
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
 * Lấy base URL của active server
 */
export function getActiveBaseUrl() {
    return getActiveServer()?.url || '/api'
}
