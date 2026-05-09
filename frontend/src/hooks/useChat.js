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
        if (!socketRef.current || !connected) return;
        socketRef.current.emit('send_message', { content });
    }, [connected]);

    return { messages, connected, error, sendMessage, sessionClosed };
}
