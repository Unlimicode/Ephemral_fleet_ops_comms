import { useState, useRef, useEffect } from 'react';
import useChat from '../hooks/useChat';

export default function ChatWindow({ tripId, token, role, counterpartName }) {
    const { messages, connected, error, sendMessage } = useChat({ tripId, token, role });
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);

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
            flex: 1,
            borderRadius: '20px', overflow: 'hidden',
            background: 'rgba(255,255,255,0.4)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 8px 32px rgba(180,130,80,0.1)'
        }}>

            {/* Header */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.3)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: connected ? '#00F5A0' : '#FF6B6B',
                        boxShadow: connected ? '0 0 8px rgba(0,245,160,0.6)' : 'none',
                        animation: connected ? 'sessionPulse 2s infinite' : 'none'
                    }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark)' }}>
                        {connected ? `Secure channel · ${counterpartName}` : 'Connecting...'}
                    </span>
                </div>
                <span style={{
                    fontSize: '11px', color: 'var(--text-muted)',
                    padding: '4px 10px', borderRadius: '50px',
                    background: 'rgba(0,245,160,0.1)',
                    border: '1px solid rgba(0,245,160,0.2)'
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
                                    ? 'rgba(13,13,13,0.85)'
                                    : 'rgba(255,255,255,0.7)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: isMine
                                    ? '1px solid rgba(255,255,255,0.1)'
                                    : '1px solid rgba(255,255,255,0.8)',
                                boxShadow: isMine
                                    ? '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)'
                                    : '0 2px 8px rgba(180,130,80,0.08)',
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
                padding: '12px 16px',
                borderTop: '1px solid rgba(255,255,255,0.5)',
                display: 'flex', gap: '10px', alignItems: 'flex-end',
                background: 'rgba(255,255,255,0.3)'
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
                        borderRadius: '14px', border: '1px solid rgba(255,255,255,0.6)',
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
                    className="glass-button"
                    style={{
                        width: '44px', height: '44px',
                        borderRadius: '14px', border: 'none',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '18px',
                        cursor: connected ? 'pointer' : 'not-allowed',
                        opacity: connected ? 1 : 0.5,
                        flexShrink: 0
                    }}
                >→</button>
            </div>
        </div>
    );
}
