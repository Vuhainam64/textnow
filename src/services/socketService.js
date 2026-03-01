import { Server } from 'socket.io';

class SocketService {
    constructor() {
        this.io = null;
        // Lazy reference: set bởi workflowEngine sau khi init
        this._getExecution = null;
    }

    // workflowEngine goi ham nay sau khi khoi dong de tranh circular import
    setExecutionGetter(fn) {
        this._getExecution = fn;
    }

    init(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });

        this.io.on('connection', (socket) => {
            console.log(`[Socket] 🔌 Client connected: ${socket.id}`);

            socket.on('join-execution', (executionId) => {
                socket.join(executionId);
                console.log(`[Socket] 👤 Client ${socket.id} joined execution: ${executionId}`);

                // Khi client rejoin, emit lai trang thai hien tai ngay
                const exec = this._getExecution?.(executionId);
                if (exec) {
                    // Emit execution status hien tai
                    socket.emit('workflow-status', { status: exec.status });

                    // Emit node dang active (neu co) — giup client thay lai khoi dang chay
                    if (exec.currentNodeId && (exec.status === 'running' || exec.status === 'stopping')) {
                        socket.emit('workflow-node-active', { nodeId: exec.currentNodeId });
                    }
                }
            });

            socket.on('disconnect', () => {
                console.log(`[Socket] 🔌 Client disconnected: ${socket.id}`);
            });
        });

        return this.io;
    }

    emit(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }

    to(room) {
        if (this.io) {
            return this.io.to(room);
        }
        return { emit: () => { } };
    }
}

const socketService = new SocketService();
export default socketService;
