import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getActiveBaseUrl } from '../lib/serverStore';

// Lấy socket URL từ active server (cùng nguồn với API)
// Bỏ /api ở cuối để lấy base socket URL: http://vps01.autopee.com:3000
function getSocketUrl() {
    const base = getActiveBaseUrl(); // e.g. "http://vps01.autopee.com:3000/api"
    return base.replace(/\/api\/?$/, ''); // → "http://vps01.autopee.com:3000"
}

let _socket = null;
let _socketUrl = null;

function getSocket() {
    const currentUrl = getSocketUrl();
    // Nếu server switch → destroy socket cũ, tạo mới
    if (_socket && _socketUrl !== currentUrl) {
        _socket.disconnect();
        _socket = null;
    }
    if (!_socket || _socket.disconnected) {
        _socketUrl = currentUrl;
        _socket = io(currentUrl, {
            transports: ['polling', 'websocket'],  // polling trước để tránh CORS upgrade fail
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });

        _socket.on('connect', () => {
            console.log('[Socket] ✅ Connected:', _socket.id, '→', currentUrl);
        });
        _socket.on('disconnect', (reason) => {
            console.warn('[Socket] ❌ Disconnected:', reason);
        });
        _socket.on('connect_error', (err) => {
            console.warn('[Socket] ⚠️ Connect error:', err.message);
        });
    }
    return _socket;
}

/**
 * useExecutionSocket
 * Subscribes to real-time execution events.
 *
 * Events nhận:
 *   workflow-log-batch   → onLogBatch([...entries])   (batched, mỗi 400ms)
 *   workflow-thread-meta → onThreadMeta({threadId, meta})  (metadata only, no logs[])
 *   workflow-status      → onStatusChange({status})
 *   workflow-node-active → onNodeActive({nodeId})  (chỉ khi single-thread)
 */
export function useExecutionSocket(executionId, {
    onLogBatch,
    onLog,          // backward compat
    onThreadUpdate, // backward compat
    onThreadMeta,
    onStatusChange,
    onNodeActive,
} = {}) {
    const socket = useRef(null);

    // Init socket once
    if (!socket.current) {
        socket.current = getSocket();
    }

    useEffect(() => {
        if (!executionId) return;
        const s = socket.current;

        const joinRoom = () => {
            s.emit('join-execution', executionId);
        };

        // Join ngay nếu đã connected, hoặc chờ connect
        if (s.connected) {
            joinRoom();
        } else {
            s.once('connect', joinRoom);
        }

        // Re-join khi reconnect (server reset → phải join lại room)
        s.on('connect', joinRoom);

        const handleLogBatch = (entries) => {
            if (Array.isArray(entries)) {
                onLogBatch?.(entries);
                if (onLog) entries.forEach(e => onLog(e));
            }
        };

        const handleThreadMeta = (data) => {
            onThreadMeta?.(data);
            if (onThreadUpdate && data?.meta) {
                onThreadUpdate({ threadId: data.threadId, thread: data.meta });
            }
        };

        const handleStatus = (data) => onStatusChange?.(data);
        const handleActive = (data) => onNodeActive?.(data);

        s.on('workflow-log-batch', handleLogBatch);
        s.on('workflow-thread-meta', handleThreadMeta);
        s.on('workflow-status', handleStatus);
        s.on('workflow-node-active', handleActive);

        return () => {
            s.off('connect', joinRoom);
            s.off('workflow-log-batch', handleLogBatch);
            s.off('workflow-thread-meta', handleThreadMeta);
            s.off('workflow-status', handleStatus);
            s.off('workflow-node-active', handleActive);
        };
    }, [executionId]); // eslint-disable-line
}
