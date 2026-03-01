import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

let _socket = null;

function getSocket() {
    if (!_socket) {
        _socket = io(SOCKET_URL, { transports: ['websocket'] });
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
    onLog,          // backward compat — gọi onLog cho từng entry trong batch
    onThreadUpdate, // backward compat
    onThreadMeta,
    onStatusChange,
    onNodeActive,
} = {}) {
    const socket = useRef(getSocket());

    useEffect(() => {
        if (!executionId) return;
        const s = socket.current;

        s.emit('join-execution', executionId);

        // Nhận batch logs (mới) — mỗi event là mảng log entries
        const handleLogBatch = (entries) => {
            if (Array.isArray(entries)) {
                onLogBatch?.(entries);
                // Backward compat: gọi onLog cho mỗi entry
                if (onLog) entries.forEach(e => onLog(e));
            }
        };

        // Nhận thread metadata (mới — không có logs[])
        const handleThreadMeta = (data) => {
            onThreadMeta?.(data);
            // Backward compat: gọi onThreadUpdate nếu có
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
            s.off('workflow-log-batch', handleLogBatch);
            s.off('workflow-thread-meta', handleThreadMeta);
            s.off('workflow-status', handleStatus);
            s.off('workflow-node-active', handleActive);
        };
    }, [executionId]); // eslint-disable-line
}
