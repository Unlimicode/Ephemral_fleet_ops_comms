import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../api/axios.js';

const formatEAT = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }) + ' EAT';
};

/**
 * Always-on client ↔ fleet manager chat thread.
 * Authenticated via the client HttpOnly cookie — works on any of the booking
 * landing view states.
 */
export default function ClientManagerThread() {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const scrollRef = useRef(null);

    const fetchMessages = useCallback(async () => {
        try {
            const res = await api.get('/messages/client/mine');
            setMessages(res.data || []);
            setError('');
        } catch (err) {
            console.error('Client thread fetch failed:', err);
            setError('Could not load messages.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMessages();
        const poll = setInterval(fetchMessages, 15000);
        return () => clearInterval(poll);
    }, [fetchMessages]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        setSending(true);
        try {
            const res = await api.post('/messages/client/mine', { body: input.trim() });
            setMessages(prev => [...prev, res.data]);
            setInput('');
        } catch (err) {
            setError(err.response?.data?.error || 'Could not send.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="glass-card" style={{ padding: '20px', borderRadius: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '16px' }}>💬</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-dark)' }}>Fleet Manager Chat</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                Direct line to your fleet manager — replies appear here, not in your inbox.
            </p>

            <div ref={scrollRef} style={{
                maxHeight: '320px', minHeight: '120px', overflowY: 'auto',
                background: 'rgba(255,255,255,0.45)', borderRadius: '12px',
                padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px',
                marginBottom: '12px',
            }}>
                {loading && <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', textAlign: 'center', margin: 0 }}>Loading…</p>}
                {!loading && messages.length === 0 && (
                    <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', textAlign: 'center', margin: 0 }}>No messages yet. Send the first one below.</p>
                )}
                {messages.map(m => {
                    const isMe = m.sender_role === 'client';
                    return (
                        <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                                maxWidth: '85%',
                                background: isMe ? '#6C63FF' : 'rgba(13,13,13,0.06)',
                                color: isMe ? '#fff' : 'var(--text-dark)',
                                borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                padding: '8px 12px',
                            }}>
                                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</p>
                            </div>
                            <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.35)', marginTop: '2px', padding: '0 4px' }}>
                                {isMe ? 'You' : 'Manager'} · {formatEAT(m.created_at)}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <textarea
                    value={input}
                    onChange={e => { setInput(e.target.value); if (error) setError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={2}
                    placeholder="Ask the fleet manager…"
                    style={{ flex: 1, background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(13,13,13,0.12)', borderRadius: '12px', padding: '10px 12px', fontSize: '13px', color: 'var(--text-dark)', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    style={{ background: sending || !input.trim() ? 'rgba(108,99,255,0.4)' : '#6C63FF', color: 'white', borderRadius: '12px', padding: '0 18px', fontSize: '16px', fontWeight: 700, border: 'none', cursor: sending || !input.trim() ? 'default' : 'pointer' }}
                >↑</button>
            </div>
            {error && <p style={{ fontSize: '12px', color: '#EF4444', fontWeight: 600, margin: '8px 0 0' }}>{error}</p>}
        </div>
    );
}
