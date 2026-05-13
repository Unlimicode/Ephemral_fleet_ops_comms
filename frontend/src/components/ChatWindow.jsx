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

const CHAT_STYLES = `
    @keyframes chatPulseRing {
        0%   { transform: scale(1);   opacity: 0.6; }
        100% { transform: scale(2.8); opacity: 0;   }
    }
    @keyframes badgeShimmer {
        0%   { background-position: -200% center; }
        100% { background-position:  200% center; }
    }
    @keyframes dotPulse {
        0%, 80%, 100% { transform: scale(0.55); opacity: 0.25; }
        40%           { transform: scale(1);    opacity: 1;    }
    }
    @keyframes msgRevealRight {
        from { opacity: 0; transform: translateX(14px); }
        to   { opacity: 1; transform: translateX(0);    }
    }
    @keyframes msgRevealLeft {
        from { opacity: 0; transform: translateX(-14px); }
        to   { opacity: 1; transform: translateX(0);     }
    }
    @keyframes sessionClosedFadeIn {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0);    }
    }
    .chat-textarea::placeholder {
        color: rgba(245,237,227,0.3);
    }
    .chat-textarea:disabled::placeholder {
        color: rgba(245,237,227,0.15);
    }
`;

export default function ChatWindow({ tripId, token, role, counterpartName, showSenderLabels = false }) {
    const { messages, connected, error, sendMessage, sessionClosed } = useChat({ tripId, token, role });
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);
    const [pendingMessages, setPendingMessages] = useState([]);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const prevConnected = useRef(connected);
    const width = useWindowWidth();
    const isMobile = width < 768;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, pendingMessages, isSending]);

    // Clear visual pending queue when connection is restored.
    // Socket.IO already buffered and replayed the emits — we just need to
    // remove the pending indicators from the UI. Deferred via setTimeout to
    // avoid calling setState synchronously inside an effect body.
    useEffect(() => {
        if (!prevConnected.current && connected) {
            setTimeout(() => setPendingMessages([]), 0);
        }
        prevConnected.current = connected;
    }, [connected]);

    const handleSend = () => {
        const content = inputValue.trim();
        if (!content) return;

        setInputValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        if (!connected) {
            // Show as pending locally; sendMessage below buffers it in Socket.IO.
            setPendingMessages(prev => [...prev, {
                content,
                from: role,
                timestamp: new Date().toISOString(),
                pending: true,
            }]);
        } else {
            setIsSending(true);
            setTimeout(() => setIsSending(false), 900);
        }

        // Always emit — Socket.IO queues the message internally when disconnected
        // and sends it automatically when the connection is restored.
        sendMessage(content);
    };

    const containerStyle = {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: isMobile ? '360px' : '520px',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '24px',
    };

    // ── PRE-CONNECTION ──────────────────────────────────────────────────────────
    // Only show the connecting screen on first connect (no messages yet).
    // If messages exist, the user is mid-session — keep the chat visible
    // and show a reconnecting indicator in the header instead.
    if (!connected && !sessionClosed && messages.length === 0 && pendingMessages.length === 0) {
        return (
            <div className="glass-card-dark" style={containerStyle}>
                <style>{CHAT_STYLES}</style>

                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '24px', padding: '40px 32px', textAlign: 'center'
                }}>
                    {/* Lock icon with concentric pulse rings */}
                    <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                position: 'absolute',
                                width: '80px', height: '80px',
                                borderRadius: '50%',
                                border: `1.5px solid rgba(108,99,255,${0.55 - i * 0.15})`,
                                animation: `chatPulseRing 2.4s ease-out ${i * 0.7}s infinite`,
                            }} />
                        ))}
                        <div style={{
                            width: '52px', height: '52px', borderRadius: '50%',
                            background: 'rgba(108,99,255,0.15)',
                            border: '1px solid rgba(108,99,255,0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '22px', position: 'relative', zIndex: 1,
                            flexShrink: 0
                        }}>🔒</div>
                    </div>

                    {/* Text */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p className="kinetic-text" style={{
                            fontSize: '16px', fontWeight: 800,
                            color: '#F0F2F7', letterSpacing: '-0.04em', margin: 0
                        }}>
                            Establishing secure channel...
                        </p>
                        <p style={{ fontSize: '13px', color: 'rgba(240,242,247,0.45)', fontWeight: 500, margin: 0 }}>
                            {counterpartName}
                        </p>
                    </div>

                    {/* Shimmer badge */}
                    <span style={{
                        padding: '6px 18px', borderRadius: '9999px',
                        background: 'linear-gradient(90deg, rgba(108,99,255,0.12) 0%, rgba(139,133,255,0.28) 50%, rgba(108,99,255,0.12) 100%)',
                        backgroundSize: '200% auto',
                        animation: 'badgeShimmer 3.5s linear infinite',
                        border: '1px solid rgba(108,99,255,0.3)',
                        fontSize: '11px', fontWeight: 700,
                        color: '#A5A0FF', letterSpacing: '0.04em'
                    }}>
                        End-to-end mediated · No PII transmitted
                    </span>

                    {error && (
                        <div style={{
                            padding: '10px 16px', borderRadius: '12px',
                            background: 'rgba(255,107,107,0.1)',
                            border: '1px solid rgba(255,107,107,0.2)',
                            color: '#FF6B6B', fontSize: '13px',
                            maxWidth: '280px', lineHeight: 1.5
                        }}>
                            {error}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── SESSION CLOSED ──────────────────────────────────────────────────────────
    if (sessionClosed) {
        return (
            <div className="glass-card-dark" style={containerStyle}>
                <style>{CHAT_STYLES}</style>

                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: '32px',
                    animation: 'sessionClosedFadeIn 0.5s ease both'
                }}>
                    <div className="glass-card" style={{
                        padding: '36px 32px', borderRadius: '24px',
                        maxWidth: '280px', width: '100%', textAlign: 'center',
                        display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center'
                    }}>
                        <div style={{ fontSize: '32px' }}>🔒</div>
                        <h3 className="kinetic-text" style={{ fontSize: '20px', margin: 0 }}>
                            Session Ended
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                            Secure channel closed
                        </p>
                        <div style={{
                            padding: '14px 16px', borderRadius: '14px', width: '100%',
                            background: 'rgba(108,99,255,0.08)',
                            border: '1px solid rgba(108,99,255,0.2)',
                            boxSizing: 'border-box'
                        }}>
                            <p style={{ fontSize: '12px', color: '#A5A0FF', lineHeight: 1.6, margin: 0 }}>
                                You have 24 hours to file a complaint if needed.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── CONNECTED ───────────────────────────────────────────────────────────────
    return (
        <div className="glass-card-dark" style={containerStyle}>
            <style>{CHAT_STYLES}</style>

            {/* arch-grid overlay */}
            <div className="arch-grid" style={{
                position: 'absolute', inset: 0,
                opacity: 0.03, pointerEvents: 'none', zIndex: 0
            }} />

            {/* Header */}
            <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'relative', zIndex: 1, flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: connected ? '#6C63FF' : 'rgba(255,255,255,0.25)',
                        boxShadow: connected ? '0 0 10px rgba(108,99,255,0.8)' : 'none',
                        animation: connected ? 'sessionPulse 2s infinite' : 'none',
                        transition: 'background 0.3s ease',
                    }} />
                    <span className="kinetic-text" style={{
                        fontSize: '14px', fontWeight: 800,
                        letterSpacing: '-0.05em', color: '#F0F2F7'
                    }}>
                        {counterpartName}
                    </span>
                    {!connected && (
                        <span style={{ fontSize: '10px', color: 'rgba(240,242,247,0.35)', fontWeight: 600 }}>
                            reconnecting…
                        </span>
                    )}
                </div>
                <span style={{
                    fontSize: '11px', fontWeight: 700, color: '#A5A0FF',
                    padding: '4px 12px', borderRadius: '9999px',
                    background: 'rgba(108,99,255,0.15)',
                    border: '1px solid rgba(108,99,255,0.25)',
                    letterSpacing: '0.03em'
                }}>
                    Mediated · No PII
                </span>
            </div>

            {/* Messages area */}
            <div style={{
                flex: 1, overflowY: 'auto', padding: '16px',
                display: 'flex', flexDirection: 'column', gap: '10px',
                position: 'relative', zIndex: 1
            }}>
                {messages.length === 0 && !error && (
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: '10px', opacity: 0.65, textAlign: 'center',
                        padding: '32px 0'
                    }}>
                        <span style={{ fontSize: '24px' }}>🔒</span>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#F0F2F7', margin: 0 }}>
                            Secure channel active
                        </p>
                        <p style={{
                            fontSize: '12px', color: 'rgba(240,242,247,0.45)',
                            maxWidth: '200px', lineHeight: 1.6, margin: 0
                        }}>
                            Messages are ephemeral and not stored permanently.
                        </p>
                    </div>
                )}

                {error && (
                    <div style={{
                        padding: '12px 16px', borderRadius: '12px',
                        background: 'rgba(255,107,107,0.1)',
                        border: '1px solid rgba(255,107,107,0.2)',
                        color: '#FF6B6B', fontSize: '13px', textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {[...messages, ...pendingMessages].map((msg, i) => {
                    const isMine = msg.from === role;
                    const isPending = !!msg.pending;
                    const senderLabel = showSenderLabels && !isMine
                        ? (msg.from === 'driver' ? 'Driver' : msg.from === 'client' ? 'Client' : null)
                        : null;
                    return (
                        <div key={i} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isMine ? 'flex-end' : 'flex-start',
                            animation: `${isMine ? 'msgRevealRight' : 'msgRevealLeft'} 0.22s ease-out both`,
                            opacity: isPending ? 0.55 : 1,
                        }}>
                        {senderLabel && (
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(240,242,247,0.4)', marginBottom: '3px', paddingLeft: '4px', letterSpacing: '0.04em' }}>
                                {senderLabel}
                            </span>
                        )}
                            <div style={{
                                maxWidth: '76%',
                                padding: '10px 14px',
                                borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                background: isMine
                                    ? isPending
                                        ? 'rgba(108,99,255,0.35)'
                                        : 'linear-gradient(135deg, #6C63FF 0%, #8B85FF 100%)'
                                    : 'rgba(255,255,255,0.07)',
                                backdropFilter: isMine ? 'none' : 'blur(20px)',
                                WebkitBackdropFilter: isMine ? 'none' : 'blur(20px)',
                                border: isMine
                                    ? '1px solid rgba(108,99,255,0.35)'
                                    : '0.5px solid rgba(255,255,255,0.12)',
                                boxShadow: isMine && !isPending
                                    ? '0 4px 18px rgba(108,99,255,0.35)'
                                    : '0 2px 8px rgba(0,0,0,0.18)',
                                color: isMine ? '#FFF' : '#F5EDE3',
                                fontSize: '14px', lineHeight: 1.55
                            }}>
                                {msg.content}
                                <div style={{
                                    fontSize: '10px', marginTop: '4px',
                                    opacity: 0.5, textAlign: isMine ? 'right' : 'left',
                                    display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
                                    alignItems: 'center', gap: '4px',
                                }}>
                                    {isPending && <span>⏳</span>}
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Typing indicator — shows briefly after sending */}
                {isSending && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{
                            padding: '10px 16px',
                            borderRadius: '18px 18px 18px 4px',
                            background: 'rgba(255,255,255,0.07)',
                            border: '0.5px solid rgba(255,255,255,0.12)',
                            display: 'flex', gap: '5px', alignItems: 'center'
                        }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    background: '#6C63FF',
                                    animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`
                                }} />
                            ))}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div style={{
                padding: isMobile ? '10px 12px' : '12px 16px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', gap: '10px', alignItems: 'flex-end',
                position: isMobile ? 'sticky' : 'relative',
                bottom: 0,
                background: 'rgba(13,13,13,0.35)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                zIndex: 1, flexShrink: 0
            }}>
                <div style={{
                    flex: 1, borderRadius: '14px',
                    border: `1px solid ${inputFocused ? 'rgba(108,99,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    transition: 'border-color 0.2s ease',
                    background: 'rgba(255,255,255,0.05)',
                    overflow: 'hidden'
                }}>
                    <textarea
                        ref={textareaRef}
                        className="chat-textarea"
                        placeholder={connected ? 'Type a message...' : 'Offline — will send on reconnect'}
                        disabled={sessionClosed}
                        rows={1}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
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
                            width: '100%', padding: '10px 14px',
                            background: 'transparent', border: 'none', outline: 'none',
                            fontSize: '14px', fontFamily: 'Inter, sans-serif',
                            color: '#F5EDE3',
                            resize: 'none', lineHeight: 1.5,
                            maxHeight: '120px', overflowY: 'auto',
                            boxSizing: 'border-box', display: 'block'
                        }}
                    />
                </div>
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || sessionClosed}
                    style={{
                        height: '44px', padding: '0 20px',
                        borderRadius: '14px', border: 'none',
                        background: inputValue.trim() && !sessionClosed
                            ? connected
                                ? 'linear-gradient(135deg, #6C63FF, #8B85FF)'
                                : 'rgba(108,99,255,0.35)'
                            : 'rgba(255,255,255,0.07)',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '16px',
                        color: inputValue.trim() && !sessionClosed ? '#FFF' : 'rgba(255,255,255,0.25)',
                        cursor: inputValue.trim() && !sessionClosed ? 'pointer' : 'not-allowed',
                        flexShrink: 0,
                        transition: 'all 0.2s ease',
                        boxShadow: inputValue.trim() && connected && !sessionClosed
                            ? '0 4px 16px rgba(108,99,255,0.45)'
                            : 'none'
                    }}
                >→</button>
            </div>
        </div>
    );
}
