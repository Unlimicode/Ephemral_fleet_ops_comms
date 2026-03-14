import React, { useState, useEffect } from 'react';
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
    const width = (function useWindowWidth() {
        const [w, setW] = useState(window.innerWidth);
        useEffect(() => {
            const handleResize = () => setW(window.innerWidth);
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }, []);
        return w;
    })();

    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            navigate(role === 'fleet_manager' ? '/manager/dispatch' : '/driver/trips', { replace: true });
        }
    }, [isAuthenticated, navigate, role]);

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
            flexDirection: 'row',
            minHeight: '100vh',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            background: isMobile ? 'var(--bg-base)' : '#0D0D0D'
        }}>

            {/* Left Panel — Dark brand (Hidden on mobile) */}
            {!isMobile && (
                <div style={{
                    width: isTablet ? '45%' : '50%',
                    position: 'relative', overflow: 'hidden',
                    background: '#0D0D0D', display: 'flex', flexDirection: 'column',
                    justifyContent: 'center', padding: isTablet ? '48px 6%' : '64px 8%'
                }}>
                    {/* Background layers */}
                    <div className="arch-grid-light parallax-layer" style={{ opacity: 0.25 }} />
                    <div className="geo-shape animate-float-slow" style={{ top: '8%', right: '-5%', color: 'rgba(245,237,227,0.06)' }}>
                        <div className="geo-triangle" style={{ transform: 'scale(2.5) rotate(15deg)' }} />
                    </div>
                    <div className="geo-shape animate-float-reverse" style={{ bottom: '-5%', left: '-8%', color: 'rgba(108,99,255,0.12)' }}>
                        <div className="geo-triangle" style={{ transform: 'scale(3) rotate(-10deg)' }} />
                    </div>

                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        {/* Logo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: isTablet ? 32 : 48 }}>
                            <img
                                src="/swiftlink-icon.png"
                                alt="Swiftlink"
                                style={{ height: isTablet ? '44px' : '56px', width: 'auto', borderRadius: 10 }}
                            />
                            <span style={{
                                fontWeight: 800, fontSize: isTablet ? '1.5rem' : '2rem',
                                letterSpacing: '-0.8px', color: '#F5EDE3', marginLeft: 10
                            }}>Swiftlink</span>
                        </div>

                        {/* Eyebrow */}
                        <div className="reveal-up active" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgba(245,237,227,0.4)' }}>Corporate Fleet Dispatch</span>
                        </div>

                        {/* Headline */}
                        <h1 className="kinetic-text reveal-up active" style={{ fontSize: 'clamp(2.4rem, 4vw, 5rem)', marginBottom: 32, color: '#F5EDE3' }}>
                            <span className="outline-text-light" style={{ display: 'block' }}>Seamless</span>
                            <span style={{ display: 'block' }}>transfers.</span>
                            <span style={{ display: 'block', color: 'var(--accent-primary)' }}>Zero trace.</span>
                        </h1>

                        {/* Subtext */}
                        <p className="reveal-up active stagger-1" style={{ fontSize: isTablet ? 14 : 16, color: 'rgba(245,237,227,0.55)', lineHeight: 1.8, maxWidth: 380, marginBottom: 48 }}>
                            Built for Kenya&apos;s MICE sector. Corporate ground transport with privacy protected at the architecture level.
                        </p>
                    </div>

                    {/* Compliance note */}
                    <div style={{ position: 'absolute', bottom: 32, left: '8%', zIndex: 1 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(245,237,227,0.2)' }}>
                            Kenya DP Act 2019 · Section 25 Compliant
                        </span>
                    </div>
                </div>
            )}

            {/* Animated triangle divider — desktop/tablet overlaying the split */}
            {!isMobile && (
                <div style={{
                    position: 'absolute', left: isTablet ? '45%' : '50%', top: 0, height: '100%',
                    width: 200, transform: 'translateX(-50%)',
                    pointerEvents: 'none', zIndex: 10, overflow: 'visible'
                }}>
                    <div className="geo-shape animate-float-slow" style={{ top: '15%', left: '50%', color: 'rgba(245,237,227,0.1)' }}>
                        <div className="geo-triangle-sm" style={{ transform: 'rotate(90deg)' }} />
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
