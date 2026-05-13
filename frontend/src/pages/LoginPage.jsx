import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import SwiftlinkLogo from '../components/SwiftlinkLogo';

function useWindowWidth() {
    const [w, setW] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setW(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return w;
}

function LoginHelpModal({ open, onClose }) {
    const [tab, setTab] = useState('manager');
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);
    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 199, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.25s ease' }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: 'rgba(245,237,227,0.97)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', transform: open ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                    <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(0,0,0,0.15)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 0' }}>
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#0D0D0D', letterSpacing: '-0.02em' }}>How to Sign In</div>
                        <div style={{ fontSize: '11px', color: '#6B6B6B', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>SwiftLink Login Help</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px', color: '#6B6B6B' }}>×</button>
                </div>
                <div style={{ display: 'flex', gap: '6px', padding: '16px 20px 0', background: 'rgba(0,0,0,0.03)', margin: '12px 20px 0', borderRadius: '12px' }}>
                    {[['manager','Fleet Manager'],['driver','Driver'],['client','Client']].map(([k,l]) => (
                        <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: tab === k ? '#6C63FF' : 'transparent', color: tab === k ? '#fff' : '#6B6B6B', transition: 'all 0.2s ease' }}>{l}</button>
                    ))}
                </div>
                <div style={{ overflowY: 'auto', padding: '16px 20px 40px', flex: 1 }}>
                    {tab === 'manager' && (<>
                        <p style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, margin: '0 0 12px' }}>Fleet Managers sign in using a <strong>magic link</strong> — no password required.</p>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}><span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#6C63FF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>1</span><span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>Select <strong>Fleet Manager</strong> on the toggle above.</span></div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}><span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#6C63FF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>2</span><span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>Enter your registered <strong>work email address</strong>.</span></div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}><span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#6C63FF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>3</span><span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>Check your inbox for an email from SwiftLink. Click <strong>"Sign in to SwiftLink"</strong>.</span></div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}><span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#6C63FF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>4</span><span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>You are taken directly to the Dispatch dashboard. The link is single-use and <strong>expires after 15 minutes</strong>.</span></div>
                        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderLeft: '3px solid #F59E0B', borderRadius: '8px', padding: '10px 14px', marginTop: '12px', fontSize: '13px', lineHeight: 1.6, color: '#2D2D2D' }}><span style={{ fontWeight: 700, color: '#F59E0B' }}>Note: </span>The Password field is not used for manager login — only the email is needed.</div>
                    </>)}
                    {tab === 'driver' && (<>
                        <p style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, margin: '0 0 12px' }}>Drivers sign in with their <strong>work email and password</strong> provided by their fleet manager.</p>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}><span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#6C63FF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>1</span><span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>Select <strong>Driver</strong> on the toggle above.</span></div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}><span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#6C63FF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>2</span><span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>Enter your <strong>work email</strong> and <strong>temporary password</strong> from the account setup email.</span></div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}><span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#6C63FF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>3</span><span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>Click <strong>Sign In</strong>. You are taken to your Trips dashboard.</span></div>
                        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderLeft: '3px solid #F59E0B', borderRadius: '8px', padding: '10px 14px', marginTop: '12px', fontSize: '13px', lineHeight: 1.6, color: '#2D2D2D' }}><span style={{ fontWeight: 700, color: '#F59E0B' }}>Note: </span>If you have not received your account setup email, contact your fleet manager.</div>
                    </>)}
                    {tab === 'client' && (<>
                        <p style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, margin: '0 0 12px' }}>Clients <strong>do not use this login page</strong>. Access is via a personal booking link sent to your corporate email.</p>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}><span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#6C63FF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>1</span><span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>Check your corporate inbox for an email with subject <strong>"Your SwiftLink booking link"</strong>.</span></div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}><span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#6C63FF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>2</span><span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>Click the link in the email. You are signed in automatically — no password needed.</span></div>
                        <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderLeft: '3px solid #6C63FF', borderRadius: '8px', padding: '10px 14px', marginTop: '12px', fontSize: '13px', lineHeight: 1.6, color: '#2D2D2D' }}><span style={{ fontWeight: 700, color: '#6C63FF' }}>Privacy: </span>Your email is never shared with your driver. Check your spam folder if you cannot find the email.</div>
                    </>)}
                </div>
            </div>
        </>
    );
}

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('fleet_manager');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [focusedField, setFocusedField] = useState(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const width = useWindowWidth();

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
            setError(err.response?.data?.error || err.response?.data?.message || 'Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
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

                    {/* Animated blobs */}
                    <div className="animate-float-slow" style={{
                        position: 'absolute', top: '10%', right: '-15%', width: 400, height: 400,
                        borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.18), transparent 70%)',
                        pointerEvents: 'none', zIndex: 0
                    }} />
                    <div className="animate-float-reverse" style={{
                        position: 'absolute', bottom: '-10%', left: '-10%', width: 350, height: 350,
                        borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.12), transparent 70%)',
                        pointerEvents: 'none', zIndex: 0
                    }} />

                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        {/* Logo */}
                        <div className="reveal-up active" style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: isTablet ? 32 : 48 }}>
                            <SwiftlinkLogo height={48} />
                        </div>

                        {/* Eyebrow */}
                        <div className="reveal-up active stagger-1" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgba(245,237,227,0.4)' }}>Corporate Fleet Dispatch</span>
                        </div>

                        {/* Headline */}
                        <h1 className="kinetic-text reveal-up active stagger-1" style={{ fontSize: 'clamp(2.4rem, 4vw, 5rem)', marginBottom: 32, color: '#F5EDE3' }}>
                            <span className="outline-text-light" style={{ display: 'block' }}>Privacy-first</span>
                            <span style={{ display: 'block' }}>fleet operations.</span>
                            <span style={{ display: 'block', color: 'var(--accent-primary)' }}>Zero trace.</span>
                        </h1>

                        {/* Subtext */}
                        <p className="reveal-up active stagger-2" style={{ fontSize: isTablet ? 14 : 16, color: 'rgba(245,237,227,0.55)', lineHeight: 1.8, maxWidth: 380, marginBottom: 48 }}>
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
                <div className="arch-grid" style={{ position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none', zIndex: 0 }} />
                <div className="geo-shape animate-float" style={{ top: '5%', right: '-3%', color: 'rgba(13,13,13,0.06)' }}>
                    <div className="geo-triangle-sm" style={{ transform: 'rotate(20deg)' }} />
                </div>
                <div className="geo-shape animate-float-slow" style={{ bottom: '8%', left: '-5%', color: 'rgba(108,99,255,0.08)' }}>
                    <div className="geo-triangle" style={{ transform: 'scale(1.5) rotate(-20deg)' }} />
                </div>

                {/* Subtle blob */}
                <div className="animate-float-slow" style={{
                    position: 'absolute', bottom: '-10%', right: '-10%', width: 300, height: 300,
                    borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.08), transparent 70%)',
                    pointerEvents: 'none', zIndex: 0
                }} />

                {/* Card wrapper */}
                <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
                    <div className="glass-card" style={{ padding: isMobile ? '32px 24px' : '48px 44px', borderRadius: '2.5rem' }}>
                        <h2 className="reveal-up active" style={{ fontSize: 28, fontWeight: 900, color: '#0D0D0D', marginBottom: 6, letterSpacing: '-0.8px' }}>Sign in</h2>
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

        {/* Floating help button */}
        <button
            onClick={() => setHelpOpen(true)}
            className="help-pill help-pill-float"
            style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50, border: 'none' }}
        >
            ? Help
        </button>

        <LoginHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
        </>
    );
}
