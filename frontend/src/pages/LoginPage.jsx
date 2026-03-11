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
            overflow: 'hidden',
            position: 'relative'
        }}>

            {/* Left Panel — Dark brand */}
            <div style={{
                flex: 1, position: 'relative', overflow: 'hidden',
                background: '#0D0D0D', display: 'flex', flexDirection: 'column',
                justifyContent: 'center', padding: isMobile ? '48px 24px' : '64px 8%'
            }}>
                {/* Background layers */}
                <div className="arch-grid-light parallax-layer" style={{ opacity: 0.25 }} />
                <div className="geo-shape animate-float-slow" style={{ top: '8%', right: '-5%', color: 'rgba(245,237,227,0.06)' }}>
                    <div className="geo-triangle" style={{ transform: 'scale(2.5) rotate(15deg)' }} />
                </div>
                <div className="geo-shape animate-float-reverse" style={{ bottom: '-5%', left: '-8%', color: 'rgba(108,99,255,0.12)' }}>
                    <div className="geo-triangle" style={{ transform: 'scale(3) rotate(-10deg)' }} />
                </div>
                <div className="geo-shape animate-spin-slow" style={{ top: '40%', left: '5%', color: 'rgba(245,237,227,0.04)' }}>
                    <div className="geo-triangle-sm" style={{ transform: 'rotate(45deg)' }} />
                </div>

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 48 }}>
                        <img
                            src="/swiftlink-icon.png"
                            alt="Swiftlink"
                            style={{ height: isMobile ? '44px' : '56px', width: 'auto', borderRadius: 10 }}
                        />
                        <span style={{
                            fontWeight: 800, fontSize: isMobile ? '1.6rem' : '2rem',
                            letterSpacing: '-0.8px', color: '#F5EDE3', marginLeft: 10
                        }}>Swiftlink</span>
                    </div>

                    {/* Eyebrow */}
                    <div className="reveal-up active" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgba(245,237,227,0.4)' }}>Corporate Fleet Dispatch</span>
                    </div>

                    {/* Headline */}
                    <h1 className="kinetic-text reveal-up active" style={{ fontSize: 'clamp(2.8rem, 5vw, 5rem)', marginBottom: 32, color: '#F5EDE3' }}>
                        <span className="outline-text-light" style={{ display: 'block' }}>Seamless</span>
                        <span style={{ display: 'block' }}>transfers.</span>
                        <span style={{ display: 'block', color: 'var(--accent-primary)' }}>Zero trace.</span>
                    </h1>

                    {/* Subtext */}
                    <p className="reveal-up active stagger-1" style={{ fontSize: 16, color: 'rgba(245,237,227,0.55)', lineHeight: 1.8, maxWidth: 380, marginBottom: 48 }}>
                        Built for Kenya&apos;s MICE sector. Corporate ground transport with privacy protected at the architecture level — not as a policy, as a technical guarantee.
                    </p>

                    {/* CTA */}
                    <div className="reveal-up active stagger-2">
                        <button
                            onClick={() => navigate('/')}
                            className="btn-premium"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 12,
                                padding: '14px 28px', borderRadius: 9999,
                                background: 'transparent', border: '1px solid rgba(245,237,227,0.25)',
                                color: '#F5EDE3', fontSize: 14, fontWeight: 600,
                                cursor: 'pointer', backdropFilter: 'blur(8px)'
                            }}
                        >
                            Book a Transfer
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Compliance note */}
                <div style={{ position: 'absolute', bottom: 32, left: isMobile ? 24 : '8%', zIndex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(245,237,227,0.2)' }}>
                        Kenya Data Protection Act 2019 · Section 25 Compliant
                    </span>
                </div>
            </div>

            {/* Animated triangle divider — desktop only */}
            {!isMobile && (
                <div style={{
                    position: 'absolute', left: '50%', top: 0, height: '100%',
                    width: 200, transform: 'translateX(-50%)',
                    pointerEvents: 'none', zIndex: 10, overflow: 'visible'
                }}>
                    {/* Large triangle — top, pointing right into light panel */}
                    <div className="geo-shape animate-float-slow" style={{
                        top: '5%', left: '50%', transform: 'translateX(-30%)',
                        color: 'rgba(13,13,13,0.18)'
                    }}>
                        <div className="geo-triangle" style={{ transform: 'scale(1.8) rotate(90deg)' }} />
                    </div>

                    {/* Medium triangle — center, pointing left into dark panel */}
                    <div className="geo-shape animate-float" style={{
                        top: '35%', left: '50%', transform: 'translateX(-70%)',
                        color: 'rgba(245,237,227,0.12)'
                    }}>
                        <div className="geo-triangle" style={{ transform: 'scale(1.3) rotate(-90deg)' }} />
                    </div>

                    {/* Small triangle — center-lower, pointing right, accent colour */}
                    <div className="geo-shape animate-float-reverse" style={{
                        top: '52%', left: '50%', transform: 'translateX(-20%)',
                        color: 'rgba(108,99,255,0.2)'
                    }}>
                        <div className="geo-triangle-sm" style={{ transform: 'rotate(90deg)' }} />
                    </div>

                    {/* Large triangle — bottom, pointing left */}
                    <div className="geo-shape animate-float-slow" style={{
                        bottom: '8%', left: '50%', transform: 'translateX(-80%)',
                        color: 'rgba(13,13,13,0.1)'
                    }}>
                        <div className="geo-triangle" style={{ transform: 'scale(2) rotate(-90deg)' }} />
                    </div>

                    {/* Extra small — mid-upper, spinning accent */}
                    <div className="geo-shape animate-spin-slow" style={{
                        top: '20%', left: '50%', transform: 'translateX(-50%)',
                        color: 'rgba(108,99,255,0.15)'
                    }}>
                        <div className="geo-triangle-xs" style={{ transform: 'rotate(45deg)' }} />
                    </div>
                </div>
            )}

            {/* Right Panel — Login card */}
            <div style={{
                flex: 1, position: 'relative', overflow: 'hidden',
                background: 'var(--bg-base)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: 40
            }}>
                {/* Background layers */}
                <div className="arch-grid" style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none', zIndex: 0 }} />
                <div className="geo-shape animate-float" style={{ top: '5%', right: '-3%', color: 'rgba(13,13,13,0.06)' }}>
                    <div className="geo-triangle-sm" style={{ transform: 'rotate(20deg)' }} />
                </div>
                <div className="geo-shape animate-float-slow" style={{ bottom: '8%', left: '-5%', color: 'rgba(108,99,255,0.08)' }}>
                    <div className="geo-triangle" style={{ transform: 'scale(1.5) rotate(-20deg)' }} />
                </div>

                {/* Card wrapper */}
                <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
                    <div className="glass-card" style={{ padding: isMobile ? '32px 24px' : '48px 44px', borderRadius: '2.5rem' }}>
                        <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0D0D0D', marginBottom: 6, letterSpacing: '-0.8px' }}>Sign in</h2>
                        <p style={{ fontSize: 15, color: '#4A4A4A', marginBottom: 32 }}>Access your Swiftlink dashboard</p>

                        {/* Role toggle */}
                        <div style={{ marginBottom: 28 }}>
                            <div style={{ display: 'flex', background: 'rgba(13,13,13,0.06)', borderRadius: 9999, padding: 4 }}>
                                {['fleet_manager', 'driver'].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRole(r)}
                                        style={{
                                            flex: 1, padding: '10px 16px', borderRadius: 9999, border: 'none',
                                            cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
                                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                            background: role === r ? '#0D0D0D' : 'transparent',
                                            color: role === r ? '#F5EDE3' : '#555555',
                                            boxShadow: role === r ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
                                        }}
                                    >
                                        {r === 'fleet_manager' ? 'Fleet Manager' : 'Driver'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Email */}
                        <div style={{ marginBottom: 14 }}>
                            <label className="form-label" style={{ color: '#0D0D0D', opacity: 0.7 }}>Work Email</label>
                            <input
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={e => { setEmail(e.target.value); setError(''); }}
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                                style={{
                                    width: '100%', padding: '14px 18px', borderRadius: 14,
                                    border: focusedField === 'email' ? '1.5px solid #0D0D0D' : '1.5px solid rgba(0,0,0,0.18)',
                                    background: focusedField === 'email' ? '#fff' : 'rgba(255,255,255,0.5)',
                                    fontSize: 15, color: '#0D0D0D', outline: 'none',
                                    boxSizing: 'border-box',
                                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                    boxShadow: focusedField === 'email' ? '0 0 0 4px rgba(13,13,13,0.06)' : 'none'
                                }}
                            />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: 24 }}>
                            <label className="form-label" style={{ color: '#0D0D0D', opacity: 0.7 }}>Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                onFocus={() => setFocusedField('password')}
                                onBlur={() => setFocusedField(null)}
                                style={{
                                    width: '100%', padding: '14px 18px', borderRadius: 14,
                                    border: focusedField === 'password' ? '1.5px solid #0D0D0D' : '1.5px solid rgba(0,0,0,0.18)',
                                    background: focusedField === 'password' ? '#fff' : 'rgba(255,255,255,0.5)',
                                    fontSize: 15, color: '#0D0D0D', outline: 'none',
                                    boxSizing: 'border-box',
                                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                    boxShadow: focusedField === 'password' ? '0 0 0 4px rgba(13,13,13,0.06)' : 'none'
                                }}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <p style={{
                                color: 'var(--accent-warning)',
                                fontSize: 13, marginBottom: 16,
                                padding: '10px 14px',
                                background: 'rgba(224,90,90,0.06)',
                                borderRadius: 10,
                                border: '1px solid rgba(224,90,90,0.15)'
                            }}>{error}</p>
                        )}

                        {/* Submit */}
                        <button
                            onClick={handleLogin}
                            disabled={loading}
                            className="btn-premium btn-dark"
                            style={{
                                width: '100%', padding: 16, borderRadius: 14,
                                fontSize: 15, letterSpacing: '0.1em', marginBottom: 24
                            }}
                        >
                            {loading ? 'Signing in...' : 'Sign In →'}
                        </button>

                        {/* Footer note */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: 'var(--accent-success)', display: 'inline-block',
                                animation: 'pulse-green 2s ease-in-out infinite'
                            }} />
                            <p style={{ fontSize: 11, color: '#6B6B6B', letterSpacing: '0.3px', textAlign: 'center' }}>
                                Protected by Mediated Ephemeral Identity
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
