import { useState } from 'react';
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
    const { login } = useAuth();
    const navigate = useNavigate();

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
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
                {/* Large warm peach blob — bottom left, matches reference circle */}
                <div className="glass-blob">
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
                </div>
                {/* Medium warm blob — top centre */}
                <div className="glass-blob">
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
                </div>
                {/* Small violet accent blob — top right, very subtle */}
                <div className="glass-blob">
                    <div style={{
                        position: 'absolute',
                        top: '10%', right: '5%',
                        width: '300px', height: '300px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(108,99,255,0.5) 0%, transparent 70%)',
                        filter: 'blur(25px)',
                        mixBlendMode: 'multiply',
                        animation: 'blobFloat3 22s ease-in-out infinite, blobPulse 11s ease-in-out infinite, glassShimmer 10s ease-in-out infinite 2s'
                    }} />
                </div>
                {/* Mid-right area */}
                <div className="glass-blob">
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
            </div>

            {/* Navigation */}
            <nav style={{
                position: 'relative', zIndex: 20,
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '28px 48px',
            }}>
                {/* Logo — icon as S + wiftlink outline text */}
                <div className="animate-fade-in-up" style={{
                    display: 'flex', alignItems: 'center',
                    gap: '0px', animationDelay: '0s'
                }}>
                    <img
                        src="/swiftlink-icon.png"
                        alt="S"
                        className="animate-icon-pop"
                        style={{ height: '99px', width: '99px', objectFit: 'contain' }}
                    />
                    <span
                        className="animate-text-slide"
                        style={{
                            fontSize: '3.9rem',
                            fontWeight: 800,
                            color: '#0D0D0D',
                            letterSpacing: '-1px',
                            lineHeight: 1,
                            fontFamily: 'Inter, sans-serif',
                            marginLeft: '2px'
                        }}
                    >wiftlink</span>
                </div>

                {/* Nav links */}
                <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
                    {['About', 'Services', 'Contact'].map((link, i) => (
                        <a key={link} href="#" style={{
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                            fontSize: '14px',
                            fontWeight: 500,
                            transition: 'var(--transition-smooth)',
                            opacity: 0,
                            animation: `fadeInUp 0.5s ease forwards`,
                            animationDelay: `${0.1 + i * 0.08}s`
                        }}
                            onMouseEnter={e => e.target.style.color = 'var(--text-dark)'}
                            onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
                        >{link}</a>
                    ))}
                </div>
            </nav>

            {/* Split content */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                padding: '0 48px 60px',
                gap: '40px',
                position: 'relative',
                zIndex: 10
            }}>

                {/* Left — brand content, pushed toward centre */}
                <div className="animate-fade-in-up" style={{
                    flex: '1.2',
                    paddingLeft: '8%',
                    animationDelay: '0.15s'
                }}>
                    <p style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '3px',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginBottom: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <span style={{ display: 'inline-block', width: '28px', height: '1.5px', background: 'var(--text-muted)' }} />
                        Corporate Fleet Dispatch
                    </p>

                    {/* Mixed outline + solid headline like reference */}
                    <h1 style={{
                        fontSize: 'clamp(3rem, 5vw, 4.5rem)',
                        fontWeight: 800,
                        color: 'transparent',
                        WebkitTextStroke: '1.5px #0D0D0D',
                        letterSpacing: '-2px',
                        lineHeight: 1.05,
                        marginBottom: '4px',
                        fontFamily: 'Inter, sans-serif'
                    }}>Seamless<br />transfers.</h1>
                    <h1 style={{
                        fontSize: 'clamp(3rem, 5vw, 4.5rem)',
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
                        maxWidth: '380px',
                        marginBottom: '20px'
                    }}>
                        Built for Kenya's MICE sector. Corporate ground transport with privacy protected at the architecture level — not as a policy, as a technical guarantee.
                    </p>

                    {/* Three feature points */}
                    {[
                        'Drivers never receive client contact details',
                        'Communication records expire automatically',
                        'Full audit trail for corporate compliance'
                    ].map((point, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            marginBottom: '10px'
                        }}>
                            <span style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: '#0D0D0D', flexShrink: 0
                            }} />
                            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{point}</span>
                        </div>
                    ))}

                    <button className="glass-button" style={{
                        marginTop: '36px',
                        display: 'inline-flex', alignItems: 'center', gap: '12px',
                        padding: '16px 32px',
                        borderRadius: '50px',
                        color: '#F5EDE3',
                        cursor: 'pointer',
                        fontSize: '15px', fontWeight: 600,
                        fontFamily: 'Inter, sans-serif',
                    }}>
                        Book a Transfer <span>→</span>
                    </button>
                </div>

                {/* Right — login card, pulled toward centre */}
                <div className="animate-slide-in-right" style={{
                    width: '400px',
                    flexShrink: 0,
                    marginRight: '20%',
                    animationDelay: '0.2s',
                    zIndex: 15
                }}>
                    <div className="glass-card" style={{ padding: '44px 40px' }}>
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
                                onChange={e => setEmail(e.target.value)}
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
                                onChange={e => setPassword(e.target.value)}
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
