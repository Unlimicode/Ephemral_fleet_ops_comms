import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import GeoBackground from '../components/GeoBackground';
import '../styles/animations.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('manager'); // 'manager' or 'driver'
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { login, isAuthenticated, role: authRole } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            if (authRole === 'fleet_manager' || authRole === 'manager') navigate('/manager/dispatch');
            else if (authRole === 'driver') navigate('/driver/trips');
        }
    }, [isAuthenticated, authRole, navigate]);

    useEffect(() => {
        const handleScroll = () => {
            const scrolled = window.pageYOffset;
            document.querySelectorAll('[data-speed]').forEach(layer => {
                const speed = parseFloat(layer.dataset.speed) || 0;
                layer.style.transform = `translateY(${scrolled * speed}px)`;
            });
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Replaced custom ripple logic with imported hook/utility once per component if needed, using ripple.js instead in production.
    // Leaving for now if it works.

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please fill in both email and password.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/login', { email, password, role });
            // Depending on backend, role might be returned as 'fleet_manager' or 'manager'
            const activeRole = role === 'manager' ? 'fleet_manager' : 'driver';
            login(res.data.token, activeRole, res.data.user);

            if (remember) {
                // Optional remember logic, auth context handles token usually
            }

            navigate(activeRole === 'fleet_manager' ? '/manager/dispatch' : '/driver/trips');
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const fonts = { fontFamily: '"Inter", sans-serif' };
    const uppercaseMuted = { fontSize: '10px', fontWeight: 900, letterSpacing: '0.3em', opacity: 0.4, textTransform: 'uppercase' };

    return (
        <div style={{ ...fonts, minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <GeoBackground density="normal" fixed={true} />
            <style>{`
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        .bare-input {
        .bare-input {
          background: transparent;
          border: none;
          outline: none;
          padding: 1.25rem 1.25rem 1.25rem 3.5rem;
          width: 100%;
          font-family: inherit;
          font-size: 1rem;
          color: #0D0D0D;
        }
        .svg-icon {
          position: absolute;
          left: 1.25rem;
          transition: color 0.3s ease;
          color: rgba(13,13,13,0.3);
        }
        .glass-input:focus-within .svg-icon {
          color: var(--accent-primary);
        }
        .btn-arrow { transition: transform 0.3s ease; }
        .btn-premium:hover .btn-arrow { transform: translateX(4px); }
      `}</style>

            {/* Removed inline blobs, grid and radial gradients */}

            {/* Header Bar */}
            <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        backgroundColor: '#0D0D0D', color: '#F5EDE3',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontStyle: 'italic', fontSize: '1.2rem'
                    }}>S</div>
                    <span style={{ fontWeight: 900, fontSize: '1.5rem', letterSpacing: '-0.05em', color: '#0D0D0D' }}>swiftlink</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <a href="#" style={{ ...uppercaseMuted, textDecoration: 'none', color: '#0D0D0D' }}>Documentation</a>
                    <button className="btn-premium btn-dark" style={{ padding: '0.625rem 1.5rem', fontSize: '11px', borderRadius: '999px', width: 'auto' }}>
                        Support
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', position: 'relative', zIndex: 10 }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '3.5rem', borderRadius: '3.5rem' }}>

                    <h2 style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '0.75rem', marginTop: 0, color: '#0D0D0D' }}>Sign in</h2>
                    <p style={{ fontSize: '1.1rem', color: 'rgba(13,13,13,0.6)', fontWeight: 500, margin: '0 0 2rem 0' }}>Access your Swiftlink dashboard</p>

                    {/* Role Toggle */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                        border: '0.5px solid rgba(255, 255, 255, 0.4)', borderRadius: '1.5rem', padding: '6px',
                        display: 'flex', marginBottom: '2rem'
                    }}>
                        <button
                            onClick={() => setRole('manager')}
                            style={{
                                flex: 1, border: 'none', padding: '0.75rem',
                                backgroundColor: role === 'manager' ? 'rgba(255,255,255,0.8)' : 'transparent',
                                color: role === 'manager' ? '#0D0D0D' : 'rgba(13,13,13,0.4)',
                                borderRadius: '1.25rem', boxShadow: role === 'manager' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >Fleet Manager</button>
                        <button
                            onClick={() => setRole('driver')}
                            style={{
                                flex: 1, border: 'none', padding: '0.75rem',
                                backgroundColor: role === 'driver' ? 'rgba(255,255,255,0.8)' : 'transparent',
                                color: role === 'driver' ? '#0D0D0D' : 'rgba(13,13,13,0.4)',
                                borderRadius: '1.25rem', boxShadow: role === 'driver' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >Driver</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        {/* Email Field */}
                        <div>
                            <div style={{ ...uppercaseMuted, color: '#0D0D0D', marginBottom: '0.5rem' }}>Work Email</div>
                            <div className="glass-input" style={{ display: 'flex', alignItems: 'center', position: 'relative', padding: 0 }}>
                                <svg className="svg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                <input
                                    type="email" className="bare-input"
                                    value={email} onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div style={{ ...uppercaseMuted, color: '#0D0D0D' }}>Password</div>
                                <a href="#" style={{ color: '#6C63FF', fontWeight: 900, fontSize: '11px', textDecoration: 'none' }}>Forgot?</a>
                            </div>
                            <div className="glass-input" style={{ display: 'flex', alignItems: 'center', position: 'relative', padding: 0 }}>
                                <svg className="svg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                <input
                                    type={showPassword ? 'text' : 'password'} className="bare-input"
                                    style={{ paddingRight: '3.5rem' }} value={password} onChange={e => setPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                />
                                <div style={{ position: 'absolute', right: '1.25rem', cursor: 'pointer', display: 'flex', color: 'rgba(13,13,13,0.4)', transition: 'color 0.3s' }} onClick={() => setShowPassword(!showPassword)} onMouseEnter={e => e.currentTarget.style.color = '#0D0D0D'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(13,13,13,0.4)'}>
                                    {showPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input type="checkbox" id="remember" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: '20px', height: '20px', borderRadius: '6px', accentColor: '#6C63FF', cursor: 'pointer' }} />
                            <label htmlFor="remember" style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(13,13,13,0.6)', cursor: 'pointer' }}>Keep me signed in</label>
                        </div>
                    </div>

                    {error && (
                        <div style={{ backgroundColor: 'rgba(224,90,90,0.1)', border: '1px solid rgba(224,90,90,0.2)', borderRadius: '12px', padding: '12px 16px', color: '#E05A5A', fontSize: '14px', marginBottom: '1.5rem' }}>
                            {error}
                        </div>
                    )}

                    <button onClick={handleLogin} disabled={loading} className="btn-premium btn-dark">
                        {loading ? 'Signing in...' : (
                            <>Sign In <span className="btn-arrow">→</span></>
                        )}
                    </button>

                    {/* Footer content inside card */}
                    <div style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.25)', textAlign: 'center' }}>
                            Protected by Architecture of Connectivity
                        </div>
                        <div style={{ width: '64px', height: '1px', backgroundColor: 'rgba(13,13,13,0.1)', margin: '1rem auto' }} />
                        <div style={{ fontSize: '0.9rem', color: '#0D0D0D', fontWeight: 600 }}>
                            New to Swiftlink? <a href="#" style={{ color: '#6C63FF', textDecoration: 'none' }}>Create account</a>
                        </div>
                    </div>

                </div>
            </div>

            {/* Page Footer Bar */}
            <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10, flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '2.5rem' }}>
                    <a href="#" style={{ ...uppercaseMuted, color: '#0D0D0D', textDecoration: 'none' }}>Privacy Policy</a>
                    <a href="#" style={{ ...uppercaseMuted, color: '#0D0D0D', textDecoration: 'none' }}>Terms of Service</a>
                    <a href="#" style={{ ...uppercaseMuted, color: '#0D0D0D', textDecoration: 'none' }}>Security Architecture</a>
                </div>
                <div style={{ ...uppercaseMuted, color: '#0D0D0D' }}>
                    © 2026 Swiftlink Technologies. All rights reserved.
                </div>
            </div>

        </div>
    );
}
