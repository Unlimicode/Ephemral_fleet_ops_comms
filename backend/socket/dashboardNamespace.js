import jwt from 'jsonwebtoken';
import { getIo } from './io.js';
import client from '../config/redis.js';

// The /dashboard namespace is strictly separate from the / trip relay namespace.
// Fleet managers connect here to receive real-time system events without any access
// to trip communication content. The namespace acts as a one-way broadcast channel
// from server to dashboard UI.

async function buildTtlRegistry() {
    const keys = await client.keys('session:trip:*:driver');
    return Promise.all(keys.map(async (key) => {
        const tripId = key.split(':')[2];
        const [driverTTL, clientTTL, msgTTL, windowTTL] = await Promise.all([
            client.ttl(`session:trip:${tripId}:driver`),
            client.ttl(`session:trip:${tripId}:client`),
            client.ttl(`messages:trip:${tripId}`),
            client.ttl(`complaint:window:${tripId}`),
        ]);
        return { trip_id: tripId, driver_ttl: driverTTL, client_ttl: clientTTL, msg_ttl: msgTTL, window_ttl: windowTTL };
    }));
}

export function registerDashboardNamespace(io) {
    const dashboardNamespace = io.of('/dashboard');

    // 30-second TTL broadcast — skipped in test to avoid keeping the process alive.
    // In prod this gives the privacy dashboard a live countdown for all active sessions.
    let ttlInterval = null;
    if (process.env.NODE_ENV !== 'test') {
        ttlInterval = setInterval(async () => {
            try {
                const registry = await buildTtlRegistry();
                dashboardNamespace.to('dashboard').emit('ttl_update', registry);
            } catch (err) {
                console.error('[dashboard] TTL broadcast error:', err);
            }
        }, 30000);
    }

    dashboardNamespace.on('connection', async (socket) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            socket.emit('auth_error', 'Unauthorised');
            return socket.disconnect(true);
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.role !== 'fleet_manager') {
                socket.emit('auth_error', 'Unauthorised');
                return socket.disconnect(true);
            }

            socket.join('dashboard');
            socket.emit('connected', { message: 'Dashboard connected' });

            // Send the current TTL state immediately on connect so the UI
            // doesn't have to wait up to 30s for the first ttl_update.
            try {
                const registry = await buildTtlRegistry();
                socket.emit('ttl_registry', registry);
            } catch (err) {
                console.error('[dashboard] registry emit error:', err);
            }

        } catch (err) {
            socket.emit('auth_error', 'Unauthorised');
            return socket.disconnect(true);
        }
    });

    return ttlInterval;
}

export function emitDashboardEvent(eventName, data) {
    const io = getIo();
    io.of('/dashboard').to('dashboard').emit(eventName, data);
}
