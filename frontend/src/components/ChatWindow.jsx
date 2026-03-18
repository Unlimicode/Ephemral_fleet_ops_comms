import { useState, useRef, useEffect } from 'react';
import useChat from '../hooks/useChat';

function useWindowWidth() {
    const [w, setW] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setW(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return w;
}

export default function ChatWindow({ tripId, token, role, counterpartName }) {
    const { messages, connected, error, sendMessage } = useChat({ tripId, token, role });
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);
    const width = useWindowWidth();
    const isMobile = width < 768;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim() || !connected) return;
        sendMessage(inputValue.trim());
        setInputValue('');
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            minHeight: isMobile ? 360 : 480,
            maxHeight: '70vh',
            borderRadius: '2rem',
            overflow: 'hidden',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '0.5px solid var(--glass-border)',
            boxShadow: '0 10px 40px rgba(180,130,80,0.12)'
        }}>

            {/* Header */}
            <div style={{
                padding: '14px 20px',
                borderBottom: '0.5px solid var(--glass-border)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(13,13,13,0.04)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: connected ? '#00F5A0' : '#FF6B6B',
                        boxShadow: connected ? '0 0 8px rgba(0,245,160,0.6)' : 'none',
                        animation: connected ? 'sessionPulse 2s infinite' : 'none'
                    }} />
                    <span style={{
                        fontSize: '14px', fontWeight: 800,
                        letterSpacing: '-0.02em',
                        color: 'var(--text-dark)'
                    }}>
                        {connected ? `Secure channel · ${counterpartName}` : 'Connecting...'}
                    </span>
                </div>
                <span style={{
                    fontSize: '11px', fontWeight: 600,
                    color: 'var(--accent-primary)',
                    padding: '4px 10px', borderRadius: '50px',
                    background: 'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(0,212,255,0.1))',
                    border: '1px solid rgba(108,99,255,0.25)'
                }}>🔒 Mediated · No PII</span>
            </div>

            {/* Messages area */}
            <div style={{
                flex: 1, overflowY: 'auto', padding: '16px',
                display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
                {messages.length === 0 && !error && (
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: '8px', opacity: 0.6
                    }}>
                        <span style={{ fontSize: '28px' }}>🔒</span>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            Secure channel established.<br />Messages are ephemeral and not stored permanently.
                        </p>
                    </div>
                )}

                {error && (
                    <div style={{
                        padding: '12px 16px', borderRadius: '12px',
                        background: 'rgba(255,107,107,0.1)',
                        border: '1px solid rgba(255,107,107,0.2)',
                        color: 'var(--accent-warning)', fontSize: '13px',
                        textAlign: 'center'
                    }}>{error}</div>
                )}

                {messages.map((msg, i) => {
                    const isMine = msg.from === role;
                    return (
                        <div key={i} style={{
                            display: 'flex',
                            justifyContent: isMine ? 'flex-end' : 'flex-start'
                        }}>
                            <div style={{
                                maxWidth: '75%',
                                padding: '10px 14px',
                                borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                background: isMine
                                    ? 'linear-gradient(135deg, #0D0D0D 0%, #1a1a2e 100%)'
                                    : 'rgba(255,255,255,0.6)',
                                backdropFilter: isMine ? 'none' : 'blur(20px)',
                                WebkitBackdropFilter: isMine ? 'none' : 'blur(20px)',
                                border: isMine
                                    ? '1px solid rgba(108,99,255,0.2)'
                                    : '0.5px solid var(--glass-border)',
                                boxShadow: isMine
                                    ? '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(108,99,255,0.1)'
                                    : '0 2px 8px rgba(180,130,80,0.06)',
                                color: isMine ? '#F5EDE3' : 'var(--text-dark)',
                                fontSize: '14px', lineHeight: 1.5
                            }}>
                                {msg.content}
                                <div style={{
                                    fontSize: '10px', marginTop: '4px',
                                    opacity: 0.6, textAlign: isMine ? 'right' : 'left'
                                }}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div style={{
                padding: '14px 16px',
                borderTop: '0.5px solid var(--glass-border)',
                display: 'flex', gap: '10px', alignItems: 'flex-end',
                background: 'rgba(13,13,13,0.03)'
            }}>
                <textarea
                    placeholder={connected ? 'Type a message...' : 'Connecting to secure channel...'}
                    disabled={!connected}
                    rows={1}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    style={{
                        flex: 1, padding: '10px 14px',
                        borderRadius: '14px',
                        border: '0.5px solid var(--glass-border)',
                        background: 'rgba(255,255,255,0.5)',
                        backdropFilter: 'blur(10px)',
                        fontSize: '14px', fontFamily: 'Inter, sans-serif',
                        color: 'var(--text-dark)', outline: 'none',
                        resize: 'none', lineHeight: 1.5,
                        maxHeight: '120px', overflowY: 'auto',
                        transition: 'var(--transition-smooth)'
                    }}
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={!connected || !inputValue.trim()}
                    style={{
                        width: '44px', height: '44px',
                        borderRadius: '14px',
                        border: 'none',
                        background: connected && inputValue.trim()
                            ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                            : 'rgba(13,13,13,0.08)',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '18px',
                        color: connected && inputValue.trim() ? '#FFF' : 'var(--text-muted)',
                        cursor: connected ? 'pointer' : 'not-allowed',
                        flexShrink: 0,
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: connected && inputValue.trim()
                            ? '0 4px 12px rgba(108,99,255,0.3)'
                            : 'none'
                    }}
                >→</button>
            </div>
        </div>
    );
}
