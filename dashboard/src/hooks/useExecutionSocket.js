import { useEffect, useRef, useCallback } from 'react';
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
 * Joins an execution room and subscribes to real-time events.
 *
 * @param {string|null} executionId
 * @param {{ onLog, onThreadUpdate, onStatusChange }} handlers
 */
export function useExecutionSocket(executionId, { onLog, onThreadUpdate, onStatusChange, onNodeActive } = {}) {
    const socket = useRef(getSocket());

    useEffect(() => {
        if (!executionId) return;
        const s = socket.current;

        s.emit('join-execution', executionId);

        const handleLog = (data) => onLog?.(data);
        const handleThread = (data) => onThreadUpdate?.(data);
        const handleStatus = (data) => onStatusChange?.(data);
        const handleActive = (data) => onNodeActive?.(data);

        s.on('workflow-log', handleLog);
        s.on('workflow-thread-update', handleThread);
        s.on('workflow-status', handleStatus);
        s.on('workflow-node-active', handleActive);

        return () => {
            s.off('workflow-log', handleLog);
            s.off('workflow-thread-update', handleThread);
            s.off('workflow-status', handleStatus);
            s.off('workflow-node-active', handleActive);
        };
    }, [executionId, onLog, onThreadUpdate, onStatusChange, onNodeActive]);
}
