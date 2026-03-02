import { Server } from 'socket.io';
import { getSession } from '../config/redisHelpers.js';
import redisClient from '../config/redis.js';

let io;

/**
 * Initializes the Socket.IO server and sets up the strict MEI connection handlers.
 * @param {import('http').Server} httpServer 
 */
export function initIo(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' },
    });

    io.on('connection', async (socket) => {
        const { tripId, role } = socket.handshake.auth || {};

        if (!tripId) {
            socket.emit('auth_error', 'Missing tripId');
            return socket.disconnect(true);
        }

        if (role !== 'driver' && role !== 'client') {
            socket.emit('auth_error', 'Invalid role');
            return socket.disconnect(true);
        }

        // ─────────────────────────────────────────────────────────────────
        // IDENTITY GATE - Mediated Ephemeral Identity (MEI) Framework
        // ─────────────────────────────────────────────────────────────────
        const sessionKey = `session:trip:${tripId}:${role}`;
        const sessionData = await getSession(sessionKey);

        if (!sessionData) {
            console.warn(`[socket] Auth failed for ${role} on trip ${tripId}: No session key`);
            socket.emit('auth_error', 'No active session for this trip');
            return socket.disconnect(true);
        }

        const roomName = `trip:${tripId}`;
        socket.join(roomName);
        console.log(`[socket] ${role} joined room ${roomName} (Socket: ${socket.id})`);
        socket.emit('session_joined', { tripId, role });

        // ─────────────────────────────────────────────────────────────────
        // MESSAGE RELAY
        // ─────────────────────────────────────────────────────────────────
        socket.on('send_message', async (data) => {
            if (!data || !data.content) {
                return socket.emit('message_error', 'Message content is required');
            }

            const isActiveSession = await getSession(sessionKey);
            if (!isActiveSession) {
                console.warn(`[socket] Relay failed for ${role} on trip ${tripId}: Session expired/deleted`);
                socket.emit('auth_error', 'Session expired');
                return socket.disconnect(true);
            }

            const payload = {
                from: role,
                content: data.content,
                timestamp: new Date().toISOString()
            };

            io.to(roomName).emit('receive_message', payload);

            // ─────────────────────────────────────────────────────────────────
            // CONDITIONAL PERSISTENCE: Message Buffering
            // ─────────────────────────────────────────────────────────────────
            // This message buffer exists purely to support conditional persistence 
            // arrays natively mapped inside Redis. If no complaint is filed within 
            // 24 hours (86400s), the TTL physically fires and the DB buffer is 
            // permanently deleted with zero intervention required naturally. 
            // The buffer is never read during normal active trip operations — it 
            // exists exclusively as insurance against an active complaint being filed.
            // ─────────────────────────────────────────────────────────────────
            const bufferKey = `messages:trip:${tripId}`;
            await redisClient.rPush(bufferKey, JSON.stringify(payload));
            await redisClient.expire(bufferKey, 86400);
        });

        socket.on('disconnect', () => {
            console.log(`[socket] ${role} disconnected from room ${roomName} (Socket: ${socket.id})`);
        });
    });

    return io;
}

/**
 * Returns the initialized io instance. Throws if called before initIo.
 * @returns {import('socket.io').Server}
 */
export function getIo() {
    if (!io) {
        throw new Error('Socket.io has not been initialized. Call initIo first.');
    }
    return io;
}
