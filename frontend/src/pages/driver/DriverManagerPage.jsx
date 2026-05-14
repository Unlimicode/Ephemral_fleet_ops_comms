import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../../api/axios.js';
import { useToast } from '../../components/Toast.jsx';

const formatEAT = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }) + ' EAT';
};

export default function DriverManagerPage() {
    const { addToast } = useToast();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef(null);

    const fetchMessages = useCallback(async () => {
        try {
            const res = await api.get('/messages/driver/mine');
            setMessages(res.data || []);
        } catch (err) {
            console.error('Fetch failed:', err);
            addToast('Could not load messages.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

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
            const res = await api.post('/messages/driver/mine', { body: input.trim() });
            setMessages(prev => [...prev, res.data]);
            setInput('');
        } catch (err) {
            addToast(err.response?.data?.error || 'Could not send.', 'error');
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{ position: 'relative', zIndex: 1, padding: '20px 16px', fontFamily: "'Be Vietnam Pro', sans-serif", maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.03em', color: '#0D0D0D', margin: 0 }}>
                    Manager
                </h1>
                <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', margin: '6px 0 0' }}>
                    Always-on thread with your fleet manager — message any time.
                </p>
            </div>

            <div style={{
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.7)',
                borderRadius: '1.5rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                display: 'flex', flexDirection: 'column',
                height: 'calc(100vh - 220px)', minHeight: '420px',
            }}>
                <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {loading && <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', textAlign: 'center' }}>Loading…</p>}
                    {!loading && messages.length === 0 && (
                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.4)', textAlign: 'center', marginTop: '40px' }}>
                            No messages yet. Send the first one — your manager will see it on the dispatch board.
                        </p>
                    )}
                    {messages.map(m => {
                        const isMe = m.sender_role === 'driver';
                        return (
                            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '78%',
                                    background: isMe ? '#6C63FF' : 'rgba(0,0,0,0.06)',
                                    color: isMe ? '#fff' : '#0D0D0D',
                                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                    padding: '10px 14px',
                                }}>
                                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</p>
                                </div>
                                <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.35)', marginTop: '4px', padding: '0 6px' }}>
                                    {isMe ? 'You' : 'Manager'} · {formatEAT(m.created_at)}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: '10px' }}>
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        rows={2}
                        placeholder="Message your fleet manager…"
                        style={{ flex: 1, padding: '10px 14px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.85)', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={sending || !input.trim()}
                        style={{ background: sending || !input.trim() ? 'rgba(108,99,255,0.4)' : '#6C63FF', color: 'white', border: 'none', borderRadius: '14px', padding: '0 22px', fontSize: '18px', cursor: sending || !input.trim() ? 'default' : 'pointer' }}
                    >↑</button>
                </div>
            </div>
        </div>
    );
}
