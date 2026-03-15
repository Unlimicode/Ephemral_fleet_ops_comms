import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export default function useChat({ tripId, token, role }) {
    const [messages, setMessages] = useState([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!tripId) return;

        const socket = io(import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL.replace('/api', ''), {
            auth: { token, tripId, role },
            transports: ['websocket'],
            withCredentials: true
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            setError(null);
        });

        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
            setError('Failed to connect to secure channel.');
        });

        socket.on('auth_error', (msg) => setError(msg));

        socket.on('receive_message', (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        socket.on('session_closed', (payload) => {
            setError(payload?.reason || 'Session has expired. This trip is complete.');
            socket.disconnect();
        });

        return () => {
            socket.disconnect();
        };
    }, [tripId, token, role]);

    const sendMessage = useCallback((content) => {
        if (!socketRef.current || !connected) return;
        socketRef.current.emit('send_message', { content });
    }, [connected]);

    return { messages, connected, error, sendMessage };
}
