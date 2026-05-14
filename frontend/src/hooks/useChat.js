// ─────────────────────────────────────────────────────────────────────────────
// useChat — Driver ↔ Client real-time chat hook (Socket.IO client side).
//
// FLOW:
//   1. Mount with { tripId, token, role } — opens a Socket.IO connection to the
//      backend relay namespace (backend/socket/io.js).
//   2. Backend verifies the role's credential (JWT for driver/manager, HttpOnly
//      cookie for client) and that session:trip:{tripId}:{role} exists in Redis.
//   3. On join, the server replays buffered messages (`message_history`) so a
//      reconnecting participant catches up without duplicates.
//   4. While connected, sendMessage() emits `send_message`; the server fan-outs
//      `receive_message` to everyone in room `trip:{tripId}` and pushes a copy
//      to the Redis buffer (for conditional persistence if a complaint is filed).
//   5. When the trip completes, the server emits `session_closed` — we set
//      sessionClosed and disconnect. Channel is now permanently dead.
//
// RECONNECT POLICY: infinite retries with exponential backoff (1s → 30s).
// connect_error is silent — transient drops are normal; only `auth_error` (a
// permanent server-side rejection) bubbles up as `error` to the UI.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export default function useChat({ tripId, token, role }) {
    const [messages, setMessages] = useState([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const [sessionClosed, setSessionClosed] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!tripId) return;

        const socket = io(import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL.replace('/api', ''), {
            auth: { token, tripId, role },
            transports: ['polling', 'websocket'],
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000,
            randomizationFactor: 0.5,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            setError(null);
        });

        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', (err) => {
            // Suppress transient errors — Socket.IO retries automatically with backoff.
            // Permanent rejections come via auth_error instead.
            console.warn('[useChat] connect_error (retrying):', err.message);
        });

        socket.on('auth_error', (msg) => setError(msg));

        // message_history fires once on join with all buffered messages.
        // It replaces the current message list so reconnecting participants
        // see the full conversation thread without duplicates.
        socket.on('message_history', (history) => {
            setMessages(history);
        });

        socket.on('receive_message', (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        socket.on('session_closed', () => {
            setSessionClosed(true);
            socket.disconnect();
        });

        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && socketRef.current && !socketRef.current.connected) {
                socketRef.current.connect();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            socket.disconnect();
        };
    }, [tripId, token, role]);

    const sendMessage = useCallback((content) => {
        if (!socketRef.current) return;
        // Emit even when temporarily disconnected — Socket.IO buffers and
        // replays the event automatically on reconnect.
        socketRef.current.emit('send_message', { content });
    }, []);

    return { messages, connected, error, sendMessage, sessionClosed };
}
