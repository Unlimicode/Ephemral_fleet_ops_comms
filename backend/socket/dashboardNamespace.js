import jwt from 'jsonwebtoken';
import { getIo } from './io.js';

// The /dashboard namespace is strictly separate from the / trip relay namespace.
// Fleet managers connect here to receive real-time system events without any access
// to trip communication content. The namespace acts as a one-way broadcast channel
// from server to dashboard UI.

export function registerDashboardNamespace(io) {
    const dashboardNamespace = io.of('/dashboard');

    dashboardNamespace.on('connection', (socket) => {
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

        } catch (err) {
            socket.emit('auth_error', 'Unauthorised');
            return socket.disconnect(true);
        }
    });
}

export function emitDashboardEvent(eventName, data) {
    const io = getIo();
    io.of('/dashboard').to('dashboard').emit(eventName, data);
}
