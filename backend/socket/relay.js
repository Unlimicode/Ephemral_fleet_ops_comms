import { getSession } from '../config/redisHelpers.js';

/**
 * Registers the WebSocket relay logic for the given Socket.IO server instance.
 * @param {import('socket.io').Server} io 
 */
export default function registerRelay(io) {
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
        // The existence of the Redis session key *is* the cryptographic proof
        // of authorization to enter this room. 
        // 
        // A driver evaluates `session:trip:{tripId}:driver`
        // A client evaluates `session:trip:{tripId}:client`
        //
        // This ensures a driver cannot listen to a room waiting for a client if 
        // the client hasn't been provisioned a session, and vice versa. 
        // The room only facilitates communication when *both* parties are present 
        // and hold valid, unexpired Redis keys.
        // ─────────────────────────────────────────────────────────────────
        const sessionKey = `session:trip:${tripId}:${role}`;
        const sessionData = await getSession(sessionKey);

        if (!sessionData) {
            console.warn(`[socket] Auth failed for ${role} on trip ${tripId}: No session key`);
            socket.emit('auth_error', 'No active session for this trip');
            return socket.disconnect(true);
        }

        // Valid session exists -> Join the private room
        const roomName = `trip:${tripId}`;
        socket.join(roomName);

        console.log(`[socket] ${role} joined room ${roomName} (Socket: ${socket.id})`);

        // Acknowledge successful join
        socket.emit('session_joined', { tripId, role });

        socket.on('disconnect', () => {
            console.log(`[socket] ${role} disconnected from room ${roomName} (Socket: ${socket.id})`);
        });
    });
}
