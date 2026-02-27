import { Server } from 'socket.io';

class SocketService {
    constructor() {
        this.io = null;
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
