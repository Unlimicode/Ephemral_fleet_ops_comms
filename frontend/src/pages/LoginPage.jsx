import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('fleet_manager');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [focusedField, setFocusedField] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    // Prevent authenticated users from seeing the login screen by auto-forwarding
    React.useEffect(() => {
        if (isAuthenticated) {
            navigate(role === 'fleet_manager' ? '/manager/dispatch' : '/driver/trips', { replace: true });
        }
    }, [isAuthenticated, navigate, role]);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLogin = async () => {
        if (!email || !password) { setError('Please enter your email and password.'); return; }
        setLoading(true); setError('');
        try {
            const endpoint = role === 'fleet_manager' ? '/auth/login' : '/drivers/auth/login';
            const res = await api.post(endpoint, { email, password });
            login(res.data.token, role, res.data.user);
            navigate(role === 'fleet_manager' ? '/manager/dispatch' : '/driver/trips');
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            minHeight: '100vh',
            width: '100%',
            background: 'var(--bg-base)',
            position: 'relative',
            overflow: 'hidden'
        }}>

            {/* Background Blobs — Fixed behind panels */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                {/* Large peach blob */}
                <div style={{
                    position: 'absolute',
                    bottom: '-15%', left: '-10%',
                    width: '650px', height: '650px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(240,180,140,0.75) 0%, rgba(230,160,110,0.75) 40%, transparent 70%)',
                    filter: 'blur(20px)',
                    mixBlendMode: 'multiply',
                    animation: 'blobFloat1 14s ease-in-out infinite, blobPulse 7s ease-in-out infinite, glassShimmer 6s ease-in-out infinite'
                }} />
                {/* Medium peach blob */}
                <div style={{
                    position: 'absolute',
                    top: '-10%', left: '30%',
                    width: '400px', height: '400px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(240,200,170,0.65) 0%, transparent 70%)',
                    filter: 'blur(22px)',
                    mixBlendMode: 'multiply',
                    animation: 'blobFloat2 18s ease-in-out infinite, blobPulse 9s ease-in-out infinite, glassShimmer 8s ease-in-out infinite 1s'
                }} />
                {/* Third peach blob */}
                <div style={{
                    position: 'absolute',
                    top: '30%', right: '-5%',
                    width: '350px', height: '350px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(230,150,100,0.6) 0%, transparent 70%)',
                    filter: 'blur(20px)',
                    mixBlendMode: 'multiply',
                    animation: 'blobFloat2 16s ease-in-out infinite reverse, blobPulse 8s ease-in-out infinite, glassShimmer 7s ease-in-out infinite 0.5s'
                }} />
            </div>

            {/* Left Panel — Brand Content */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: isMobile ? '40px 24px' : '60px 8%',
                position: 'relative',
                zIndex: 1
            }}>
                <div className="animate-fade-in-up">
                    {/* Brand Logo - Inline with text */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', gap: '0px' }}>
                        <img
                            src="/swiftlink-icon.png"
                            alt="S"
                            style={{ height: isMobile ? '50px' : '80px', width: 'auto', objectFit: 'contain' }}
                        />
                        <span style={{
                            fontSize: isMobile ? '2rem' : '3.2rem',
                            fontWeight: 800,
                            color: 'var(--text-dark)',
                            fontFamily: 'Inter, sans-serif',
                            letterSpacing: '-2px'
                        }}>wiftlink</span>
                    </div>

                    <p style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '3px',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <span style={{ display: 'inline-block', width: '28px', height: '1.5px', background: 'var(--text-muted)' }} />
                        Corporate Fleet Dispatch
                    </p>

                    <h1 style={{
                        fontSize: 'clamp(2.5rem, 4vw, 4rem)',
                        fontWeight: 800,
                        color: 'transparent',
                        WebkitTextStroke: '1.5px #0D0D0D',
                        letterSpacing: '-2px',
                        lineHeight: 1.05,
                        marginBottom: '4px',
                        fontFamily: 'Inter, sans-serif'
                    }}>Seamless<br />transfers.</h1>
                    <h1 style={{
                        fontSize: 'clamp(2.5rem, 4vw, 4rem)',
                        fontWeight: 800,
                        color: '#0D0D0D',
                        letterSpacing: '-2px',
                        lineHeight: 1.05,
                        marginBottom: '32px',
                        fontFamily: 'Inter, sans-serif'
                    }}>Zero trace.</h1>

                    <p style={{
                        fontSize: '16px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.8,
                        maxWidth: '400px',
                        marginBottom: '32px'
                    }}>
                        Built for Kenya's MICE sector. Corporate ground transport with privacy protected at the architecture level — not as a policy, as a technical guarantee.
                    </p>

                    <button
                        onClick={() => navigate('/')}
                        className="glass-button"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '12px',
                            padding: '16px 32px',
                            borderRadius: '50px',
                            color: '#F5EDE3',
                            cursor: 'pointer',
                            fontSize: '15px', fontWeight: 600,
                            fontFamily: 'Inter, sans-serif',
                        }}
                    >
                        Book a Transfer <span>→</span>
                    </button>
                </div>
            </div>

            {/* Right Panel — Login Card */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                position: 'relative',
                zIndex: 1
            }}>
                <div className="animate-slide-in-right" style={{ width: '100%', maxWidth: '400px' }}>
                    <div className="glass-card" style={{ padding: isMobile ? '32px 24px' : '44px 40px' }}>
                        <h2 style={{
                            fontSize: '22px', fontWeight: 700,
                            color: 'var(--text-dark)', marginBottom: '6px'
                        }}>Sign in</h2>
                        <p style={{
                            fontSize: '14px', color: 'var(--text-secondary)',
                            marginBottom: '28px'
                        }}>Access your Swiftlink dashboard</p>

                        {/* Role selector */}
                        <div style={{
                            display: 'flex',
                            background: '#F0EEEA',
                            borderRadius: '50px',
                            padding: '4px',
                            marginBottom: '24px'
                        }}>
                            {['fleet_manager', 'driver'].map(r => (
                                <button key={r} onClick={() => setRole(r)} className={role === r ? "glass-button" : ""} style={{
                                    flex: 1, padding: '10px',
                                    borderRadius: '50px', border: role === r ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                                    cursor: 'pointer',
                                    fontSize: '13px', fontWeight: 600,
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'var(--transition-smooth)',
                                    background: role === r ? 'rgba(13,13,13,0.85)' : 'transparent',
                                    color: role === r ? '#F5EDE3' : 'var(--text-secondary)',
                                    animationName: role === r ? 'glassActivate' : 'none',
                                    animationDuration: '0.4s'
                                }}>
                                    {r === 'fleet_manager' ? 'Fleet Manager' : 'Driver'}
                                </button>
                            ))}
                        </div>

                        {/* Email input */}
                        <div style={{ marginBottom: '14px' }}>
                            <input
                                type="email" placeholder="Work email" value={email}
                                onChange={e => { setEmail(e.target.value); setError(''); }}
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                                style={{
                                    width: '100%', padding: '13px 16px',
                                    borderRadius: '12px',
                                    border: focusedField === 'email'
                                        ? '1.5px solid #0D0D0D'
                                        : '1.5px solid rgba(0,0,0,0.1)',
                                    background: 'var(--bg-input)',
                                    fontSize: '14px', fontFamily: 'Inter, sans-serif',
                                    color: 'var(--text-dark)', outline: 'none',
                                    boxSizing: 'border-box',
                                    transition: 'var(--transition-smooth)',
                                    boxShadow: focusedField === 'email'
                                        ? '0 0 0 3px rgba(13,13,13,0.06)'
                                        : 'none'
                                }}
                            />
                        </div>

                        {/* Password input */}
                        <div style={{ marginBottom: '20px' }}>
                            <input
                                type="password" placeholder="Password" value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                onFocus={() => setFocusedField('password')}
                                onBlur={() => setFocusedField(null)}
                                style={{
                                    width: '100%', padding: '13px 16px',
                                    borderRadius: '12px',
                                    border: focusedField === 'password'
                                        ? '1.5px solid #0D0D0D'
                                        : '1.5px solid rgba(0,0,0,0.1)',
                                    background: 'var(--bg-input)',
                                    fontSize: '14px', fontFamily: 'Inter, sans-serif',
                                    color: 'var(--text-dark)', outline: 'none',
                                    boxSizing: 'border-box',
                                    transition: 'var(--transition-smooth)',
                                    boxShadow: focusedField === 'password'
                                        ? '0 0 0 3px rgba(13,13,13,0.06)'
                                        : 'none'
                                }}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <p style={{
                                color: 'var(--accent-warning)',
                                fontSize: '13px', marginBottom: '16px',
                                padding: '10px 14px',
                                background: 'rgba(224,90,90,0.06)',
                                borderRadius: '10px',
                                border: '1px solid rgba(224,90,90,0.15)'
                            }}>{error}</p>
                        )}

                        {/* Sign In button */}
                        <button
                            onClick={handleLogin} disabled={loading}
                            className="glass-button"
                            style={{
                                width: '100%', padding: '14px',
                                borderRadius: '14px',
                                color: '#F5EDE3',
                                fontSize: '15px', fontWeight: 700,
                                fontFamily: 'Inter, sans-serif',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'center', gap: '8px'
                            }}
                        >
                            {loading ? 'Signing in...' : 'Sign In →'}
                        </button>

                        <p style={{
                            textAlign: 'center', marginTop: '20px',
                            fontSize: '11px', color: 'var(--text-muted)',
                            letterSpacing: '0.3px'
                        }}>
                            Protected by Mediated Ephemeral Identity
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
