import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import useWindowWidth from '../../hooks/useWindowWidth.js';

const GLASS_PANEL = {
    background: 'rgba(255,255,255,0.45)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.65)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.06)',
    borderRadius: '2rem',
};

const formatEAT = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }) + ' EAT';
};

const previewText = (s, n = 60) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

function ThreadList({ threads, activeKey, onSelect, isMobile, type }) {
    if (!threads.length) {
        return (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'rgba(0,0,0,0.4)', fontSize: '13px' }}>
                No {type} threads yet.
            </div>
        );
    }
    return (
        <div style={{ overflowY: 'auto', maxHeight: isMobile ? 'auto' : '70vh' }}>
            {threads.map(t => {
                const key = type === 'driver' ? t.driver_id : t.client_email;
                const isActive = activeKey === key;
                const heading = type === 'driver' ? t.driver_name : (t.client_first_name ? `${t.client_first_name} · ${t.client_email}` : t.client_email);
                return (
                    <div
                        key={key}
                        onClick={() => onSelect(t)}
                        style={{
                            cursor: 'pointer',
                            padding: '14px 18px',
                            borderBottom: '1px solid rgba(0,0,0,0.04)',
                            background: isActive ? 'rgba(108,99,255,0.08)' : 'transparent',
                            transition: 'background 0.15s ease',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0D0D0D', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {heading}
                            </p>
                            {t.unread_count > 0 && (
                                <span style={{
                                    background: '#6C63FF', color: 'white', borderRadius: '999px',
                                    padding: '1px 8px', fontSize: '10px', fontWeight: 800,
                                    flexShrink: 0,
                                }}>{t.unread_count}</span>
                            )}
                        </div>
                        <p style={{ margin: '4px 0 2px 0', fontSize: '12px', color: 'rgba(0,0,0,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.last_sender_role === 'fleet_manager' ? 'You: ' : ''}{previewText(t.last_message)}
                        </p>
                        <p style={{ margin: 0, fontSize: '10px', color: 'rgba(0,0,0,0.35)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {t.last_message_at ? formatEAT(t.last_message_at) : '—'}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

function MessagePane({ thread, threadType, messages, onSend, loading, isMobile, onBack }) {
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        setSending(true);
        try {
            await onSend(input.trim());
            setInput('');
        } finally {
            setSending(false);
        }
    };

    if (!thread) {
        return (
            <div style={{ ...GLASS_PANEL, padding: '48px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '320px' }}>
                <div>
                    <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'rgba(0,0,0,0.2)' }}>chat</span>
                    <p style={{ margin: '12px 0 0', fontSize: '14px', color: 'rgba(0,0,0,0.5)' }}>Select a thread to view messages.</p>
                </div>
            </div>
        );
    }

    const heading = threadType === 'driver'
        ? thread.driver_name || thread.driver?.full_name
        : (thread.client_first_name || thread.client?.client_first_name)
            ? `${thread.client_first_name || thread.client.client_first_name} · ${thread.client_email || thread.client.client_email}`
            : (thread.client_email || thread.client?.client_email);

    return (
        <div style={{ ...GLASS_PANEL, display: 'flex', flexDirection: 'column', minHeight: '560px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isMobile && (
                    <button onClick={onBack} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>‹</button>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0D0D0D' }}>{heading}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                        {threadType === 'driver' ? 'Driver thread' : 'Client thread'}
                    </p>
                </div>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '380px' }}>
                {loading && <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', textAlign: 'center' }}>Loading…</p>}
                {!loading && messages.length === 0 && <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', textAlign: 'center' }}>No messages yet. Send the first one.</p>}
                {messages.map(m => {
                    const isMe = m.sender_role === 'fleet_manager';
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
                                {isMe ? 'You' : (threadType === 'driver' ? 'Driver' : 'Client')} · {formatEAT(m.created_at)}
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
                    placeholder="Type a message…"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
                <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    style={{ background: sending || !input.trim() ? 'rgba(108,99,255,0.4)' : '#6C63FF', color: 'white', border: 'none', borderRadius: '14px', padding: '0 22px', fontSize: '18px', cursor: sending || !input.trim() ? 'default' : 'pointer' }}
                >↑</button>
            </div>
        </div>
    );
}

export default function ManagerMessagesPage() {
    const { token } = useAuth();
    const { addToast } = useToast();
    const width = useWindowWidth();
    const isMobile = width < 768;

    const [tab, setTab] = useState('drivers');
    const [driverThreads, setDriverThreads] = useState([]);
    const [clientThreads, setClientThreads] = useState([]);
    const [loadingThreads, setLoadingThreads] = useState(true);

    const [activeKey, setActiveKey] = useState(null);
    const [activeThread, setActiveThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingThread, setLoadingThread] = useState(false);

    const activeKeyRef = useRef(null);
    activeKeyRef.current = activeKey;
    const tabRef = useRef(tab);
    tabRef.current = tab;

    const refreshThreads = useCallback(async () => {
        setLoadingThreads(true);
        try {
            const [drvRes, clRes] = await Promise.all([
                api.get('/messages/threads/drivers'),
                api.get('/messages/threads/clients'),
            ]);
            setDriverThreads(drvRes.data || []);
            setClientThreads(clRes.data || []);
        } catch (err) {
            console.error('Failed to load message threads:', err);
            addToast('Could not load message threads.', 'error');
        } finally {
            setLoadingThreads(false);
        }
    }, [addToast]);

    useEffect(() => { refreshThreads(); }, [refreshThreads]);

    // WebSocket: refresh on new direct_message events
    useEffect(() => {
        if (!token) return;
        const socket = io((import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/dashboard', { auth: { token } });
        socket.on('direct_message', (data) => {
            refreshThreads();
            // If the message belongs to the currently open thread, append it
            if (data.scope === 'driver' && tabRef.current === 'drivers' && data.driver_id === activeKeyRef.current) {
                setMessages(prev => [...prev, { id: `tmp-${Date.now()}`, sender_role: data.sender_role, body: data.body, created_at: data.created_at }]);
            } else if (data.scope === 'client' && tabRef.current === 'clients' && data.client_email === activeKeyRef.current) {
                setMessages(prev => [...prev, { id: `tmp-${Date.now()}`, sender_role: data.sender_role, body: data.body, created_at: data.created_at }]);
            }
        });
        return () => { socket.disconnect(); };
    }, [token, refreshThreads]);

    const handleSelectThread = async (thread) => {
        const key = tab === 'drivers' ? thread.driver_id : thread.client_email;
        setActiveKey(key);
        setActiveThread(thread);
        setMessages([]);
        setLoadingThread(true);
        try {
            const url = tab === 'drivers'
                ? `/messages/threads/driver/${key}`
                : `/messages/threads/client/${encodeURIComponent(key)}`;
            const res = await api.get(url);
            setMessages(res.data.messages || []);
            refreshThreads(); // Clear unread badge
        } catch (err) {
            console.error('Failed to load thread:', err);
            addToast('Could not load thread.', 'error');
        } finally {
            setLoadingThread(false);
        }
    };

    const handleSend = async (body) => {
        try {
            const url = tab === 'drivers'
                ? `/messages/threads/driver/${activeKey}`
                : `/messages/threads/client/${encodeURIComponent(activeKey)}`;
            const res = await api.post(url, { body });
            setMessages(prev => [...prev, res.data]);
            refreshThreads();
        } catch (err) {
            console.error('Send failed:', err);
            addToast('Could not send message.', 'error');
        }
    };

    const threads = tab === 'drivers' ? driverThreads : clientThreads;

    return (
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1440px', margin: '0 auto', padding: isMobile ? '16px' : '20px 32px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: isMobile ? '36px' : '56px', fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase', color: '#0D0D0D', lineHeight: 1, margin: 0 }}>
                    Messages
                </h1>
                <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.5)', fontWeight: 500, margin: '10px 0 0 0' }}>
                    Direct threads with drivers and clients — outside of any active trip.
                </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {['drivers', 'clients'].map(t => (
                    <button
                        key={t}
                        onClick={() => { setTab(t); setActiveKey(null); setActiveThread(null); setMessages([]); }}
                        style={{
                            background: tab === t ? '#6C63FF' : 'rgba(255,255,255,0.5)',
                            color: tab === t ? 'white' : 'rgba(0,0,0,0.5)',
                            borderRadius: '999px', padding: '10px 24px', fontSize: '13px',
                            fontWeight: 700, border: 'none', cursor: 'pointer',
                            fontFamily: "'Be Vietnam Pro', sans-serif",
                            textTransform: 'capitalize'
                        }}
                    >
                        {t} {threads.filter(x => x.unread_count > 0).length > 0 && tab !== t ? `· ${threads.filter(x => x.unread_count > 0).length}` : ''}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: '20px' }}>
                {(!isMobile || !activeKey) && (
                    <div style={GLASS_PANEL}>
                        {loadingThreads ? (
                            <p style={{ padding: '32px', textAlign: 'center', color: 'rgba(0,0,0,0.4)', fontSize: '13px' }}>Loading threads…</p>
                        ) : (
                            <ThreadList
                                threads={threads}
                                activeKey={activeKey}
                                onSelect={handleSelectThread}
                                isMobile={isMobile}
                                type={tab === 'drivers' ? 'driver' : 'client'}
                            />
                        )}
                    </div>
                )}

                {(!isMobile || activeKey) && (
                    <MessagePane
                        thread={activeThread}
                        threadType={tab === 'drivers' ? 'driver' : 'client'}
                        messages={messages}
                        onSend={handleSend}
                        loading={loadingThread}
                        isMobile={isMobile}
                        onBack={() => { setActiveKey(null); setActiveThread(null); setMessages([]); }}
                    />
                )}
            </div>
        </div>
    );
}
