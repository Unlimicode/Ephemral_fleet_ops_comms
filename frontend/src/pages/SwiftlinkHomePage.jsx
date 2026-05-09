import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import '../styles/tokens.css';
import '../styles/animations.css';
import SwiftlinkLogo from '../components/SwiftlinkLogo';

export default function SwiftlinkHomePage() {
    const navigate = useNavigate();
    const { isAuthenticated, role } = useAuth();
    const [bookingForm, setBookingForm] = useState({
        client_first_name: '',
        client_corporate_email: '',
        pickup_location: '',
        destination: '',
        date: '',
        time: '',
        flight_number: '',
        special_requirements: ''
    });
    const [contactForm, setContactForm] = useState({
        name: '',
        company: '',
        email: '',
        message: ''
    });
    const [bookingStatus, setBookingStatus] = useState({ loading: false, success: false, error: null, email: '' });
    const [contactSent, setContactSent] = useState(false);
    const [contactError, setContactError] = useState(null);
    const [lifecyclePhase, setLifecyclePhase] = useState(0);
    const [sessionTime, setSessionTime] = useState('01:42:17');

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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            if (role === 'fleet_manager') navigate('/manager/dispatch');
            else if (role === 'driver') navigate('/driver/trips');
        }
    }, [isAuthenticated, role, navigate]);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const ratio = entry.intersectionRatio;
                if (ratio > 0.1) {
                    entry.target.querySelectorAll('.reveal-up').forEach(el => el.classList.add('active'));
                }
                if (ratio > 0 && !isMobile) {
                    if (entry.target.classList.contains('mask-merge-up')) {
                        const v = 15 - ratio * 15;
                        entry.target.style.clipPath = `polygon(0 ${v}%, 50% 0, 100% ${v}%, 100% 100%, 0 100%)`;
                    }
                    if (entry.target.classList.contains('mask-merge-down')) {
                        const v = 85 + ratio * 15;
                        entry.target.style.clipPath = `polygon(0 0, 100% 0, 100% ${v}%, 50% 100%, 0 ${v}%)`;
                    }
                }
            });
        }, { threshold: Array.from({ length: 11 }, (_, i) => i / 10) });
        document.querySelectorAll('.sticky-section').forEach(s => observer.observe(s));

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.intersectionRatio > 0.05) {
                    entry.target.querySelectorAll('.reveal-up').forEach(el => el.classList.add('active'));
                }
            });
        }, { threshold: [0, 0.05, 0.1] });
        document.querySelectorAll('section:not(.sticky-section)').forEach(s => revealObserver.observe(s));

        return () => { observer.disconnect(); revealObserver.disconnect(); };
    }, []);

    useEffect(() => {
        const handler = () => {
            const scrolled = window.scrollY;
            document.querySelectorAll('.parallax-layer[data-speed]').forEach(layer => {
                const speed = parseFloat(layer.getAttribute('data-speed')) || 0;
                layer.style.transform = `translateY(${scrolled * speed}px)`;
            });
        };
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    useEffect(() => {
        const cleanup = [];
        document.querySelectorAll('.btn-premium').forEach(btn => {
            const handler = (e) => {
                const rect = btn.getBoundingClientRect();
                const span = document.createElement('span');
                span.style.cssText = `position:absolute;width:150px;height:150px;left:${e.clientX - rect.left - 75}px;top:${e.clientY - rect.top - 75}px;background:rgba(255,255,255,0.25);border-radius:50%;transform:scale(0);animation:ripple 0.6s linear;pointer-events:none;`;
                btn.appendChild(span);
                setTimeout(() => span.remove(), 600);
            };
            btn.addEventListener('click', handler);
            cleanup.push({ btn, handler });
        });
        return () => cleanup.forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
    }, []);

    useEffect(() => {
        let seconds = 6137;
        const interval = setInterval(() => {
            seconds += 1;
            const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
            const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
            const s = String(seconds % 60).padStart(2, '0');
            setSessionTime(`${h}:${m}:${s}`);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const durations = [3000, 2500, 2500];
        let phase = 0;
        const advance = () => {
            phase = (phase + 1) % 3;
            setLifecyclePhase(phase);
        };
        let timeout = setTimeout(advance, durations[0]);
        const cycle = () => {
            timeout = setTimeout(() => {
                advance();
                cycle();
            }, durations[phase]);
        };
        cycle();
        return () => clearTimeout(timeout);
    }, []);

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        setBookingStatus({ ...bookingStatus, loading: true, error: null });
        try {
            const pickup_time = `${bookingForm.date}T${bookingForm.time}:00Z`;
            await api.post('/bookings', { ...bookingForm, pickup_time });
            setBookingStatus({ loading: false, success: true, error: null, email: bookingForm.client_corporate_email });
            setBookingForm({
                client_first_name: '',
                client_corporate_email: '',
                pickup_location: '',
                destination: '',
                date: '',
                time: '',
                flight_number: '',
                special_requirements: ''
            });
        } catch {
            setBookingStatus({ loading: false, success: false, error: 'Failed to request transfer.', email: '' });
        }
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        setContactError(null);
        try {
            await api.post('/contact', contactForm);
            setContactSent(true);
        } catch {
            setContactError('Failed to send enquiry. Please try again.');
        }
    };

    return (
        <div style={{ background: 'var(--bg-base)', color: 'var(--text-dark)', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>

            {/* ── Nav ── */}
            <nav style={{
                position: 'fixed', top: isMobile ? 12 : 24, left: '50%', transform: 'translateX(-50%)',
                width: isMobile ? '94%' : '90%', maxWidth: 1280, zIndex: 200,
                background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 9999,
                padding: isMobile ? '12px 20px' : '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SwiftlinkLogo height={isMobile ? 28 : 36} />
                    <span style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 900, fontSize: isMobile ? '15px' : '18px', letterSpacing: '-0.03em', color: '#0D0D0D' }}>SwiftLink</span>
                </div>

                {isMobile ? (
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}
                    >
                        <div style={{ width: 24, height: 2, background: 'var(--text-dark)', marginBottom: 5, borderRadius: 2 }} />
                        <div style={{ width: 24, height: 2, background: 'var(--text-dark)', marginBottom: 5, borderRadius: 2 }} />
                        <div style={{ width: 16, height: 2, background: 'var(--text-dark)', marginLeft: 'auto', borderRadius: 2 }} />
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {['How it works', 'Privacy', 'Corporate'].map((label, i) => (
                            <a key={label} href={['#how', '#privacy', '#corporate'][i]} style={{
                                color: 'inherit', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                                padding: '8px 18px', borderRadius: 9999,
                                background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.4)',
                                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                                transition: 'background 0.2s ease, transform 0.2s ease'
                            }}>{label}</a>
                        ))}
                        <Link to="/login" style={{
                            color: '#F5EDE3', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                            padding: '8px 18px', borderRadius: 9999,
                            background: 'var(--accent-primary)', border: '1px solid var(--accent-primary)',
                            transition: 'background 0.2s ease, transform 0.2s ease'
                        }}>Login</Link>
                    </div>
                )}
            </nav>

            {/* ── Mobile Menu Overlay ── */}
            {isMobile && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 300,
                    visibility: mobileMenuOpen ? 'visible' : 'hidden', pointerEvents: mobileMenuOpen ? 'auto' : 'none'
                }}>
                    <div
                        onClick={() => setMobileMenuOpen(false)}
                        style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,13,0.3)', backdropFilter: 'blur(8px)', opacity: mobileMenuOpen ? 1 : 0, transition: 'opacity 0.4s' }}
                    />
                    <div style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: '80%', maxWidth: 300,
                        background: '#F5EDE3', padding: 40, display: 'flex', flexDirection: 'column', gap: 24,
                        transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'none', border: 'none', fontSize: 32, alignSelf: 'flex-end', cursor: 'pointer', padding: 0 }}>×</button>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 40 }}>
                            {['How it works', 'Privacy', 'Corporate'].map((label, i) => (
                                <a key={label} href={['#how', '#privacy', '#corporate'][i]} onClick={() => setMobileMenuOpen(false)} style={{ color: '#0D0D0D', textDecoration: 'none', fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>{label}</a>
                            ))}
                        </div>
                        <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn-premium btn-dark" style={{ marginTop: 'auto', textAlign: 'center', textDecoration: 'none', padding: 18, borderRadius: 16 }}>Login to Dashboard</Link>
                    </div>
                </div>
            )}

            {/* ── Main ── */}
            <main style={{ position: 'relative' }}>

                {/* ══ Section 1: Hero ══ */}
                <section className={`sticky-section${!isMobile ? ' mask-merge-down' : ''}`} style={{ background: 'var(--bg-base)', position: 'relative', zIndex: 10, paddingBottom: isMobile ? 64 : 0, overflow: 'visible' }}>
                    <div className="arch-grid parallax-layer" data-speed="0.2" />
                    {!isMobile && (
                        <>
                            <div className="geo-shape" style={{ top: '15%', right: '8%', color: 'rgba(13,13,13,0.12)' }}>
                                <div className="geo-triangle animate-float-slow" style={{ transform: 'rotate(12deg) scale(2)' }} />
                            </div>
                            <div className="geo-shape" style={{ bottom: '10%', left: '6%', color: 'rgba(108,99,255,0.12)' }}>
                                <div className="geo-triangle animate-float-reverse" style={{ transform: 'rotate(-15deg) scale(1.5)' }} />
                            </div>
                        </>
                    )}

                    <div className="section-inner" style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : '7fr 5fr',
                        gap: isMobile ? 48 : 64,
                        alignItems: 'center',
                        paddingTop: isMobile ? 88 : 160
                    }}>
                        {/* Left column */}
                        <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                            <div className="reveal-up active">
                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3em', opacity: 0.4 }}>
                                    — Kenya&apos;s Premier MICE Transport
                                </span>
                            </div>
                            <h1 className="kinetic-text reveal-up active" style={{ fontSize: isMobile ? '3.2rem' : 'clamp(3.5rem, 8vw, 7rem)', margin: '16px 0', lineHeight: 1 }}>
                                <span className={`${!isMobile ? 'outline-text' : ''}`}>Corporate transfers.</span>
                                <span style={{ display: 'block', marginTop: 12 }}>Zero compromise.</span>
                            </h1>
                            <p className="reveal-up active" style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: isMobile ? 'none' : 500, margin: '24px auto 40px' }}>
                                Privacy-first ground transport for international business travellers. Your contact details are never shared.
                            </p>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                <div className="glass-card reveal-up active stagger-1" style={{ padding: '8px 16px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>🔒 Privacy First</div>
                                <div className="glass-card reveal-up active stagger-1" style={{ padding: '8px 16px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>⚡ Live Logic</div>
                            </div>
                        </div>

                        {/* Right column — booking form */}
                        <div className="glass-card reveal-up active stagger-2" style={{
                            padding: isMobile ? '32px 24px' : 40,
                            borderRadius: isMobile ? '2rem' : '3rem',
                            maxWidth: 500,
                            margin: '0 auto',
                            width: '100%'
                        }}>
                            {!bookingStatus.success ? (
                                <>
                                    <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Book a Transfer</h2>
                                    <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                                            <input className="glass-input" type="text" placeholder="Full Name" required value={bookingForm.client_first_name} onChange={e => setBookingForm({ ...bookingForm, client_first_name: e.target.value })} style={{ width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                            <input className="glass-input" type="email" placeholder="Corporate Email" required value={bookingForm.client_corporate_email} onChange={e => setBookingForm({ ...bookingForm, client_corporate_email: e.target.value })} style={{ width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                                            <input className="glass-input" type="text" placeholder="Pickup Location" required value={bookingForm.pickup_location} onChange={e => setBookingForm({ ...bookingForm, pickup_location: e.target.value })} style={{ width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                            <input className="glass-input" type="text" placeholder="Destination" required value={bookingForm.destination} onChange={e => setBookingForm({ ...bookingForm, destination: e.target.value })} style={{ width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                            <input className="glass-input" type="date" required value={bookingForm.date} onChange={e => setBookingForm({ ...bookingForm, date: e.target.value })} style={{ width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                            <input className="glass-input" type="time" required value={bookingForm.time} onChange={e => setBookingForm({ ...bookingForm, time: e.target.value })} style={{ width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                        </div>
                                        <button type="submit" disabled={bookingStatus.loading} className="btn-premium btn-dark" style={{ width: '100%', padding: 18, borderRadius: 12, marginTop: 10, fontSize: 15, letterSpacing: '0.05em' }}>
                                            {bookingStatus.loading ? '...' : 'Request Transfer ✓'}
                                        </button>
                                        {bookingStatus.error && <p style={{ fontSize: 12, color: 'var(--accent-warning)', textAlign: 'center' }}>{bookingStatus.error}</p>}
                                    </form>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                                    <div style={{ fontSize: 40, color: 'var(--accent-success)', marginBottom: 12 }}>✓</div>
                                    <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Confirmed</h2>
                                    <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                                        Link sent to <strong>{bookingStatus.email}</strong>.
                                    </p>
                                    <button onClick={() => setBookingStatus({ ...bookingStatus, success: false })} style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>New Booking</button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ══ Section 2: Intro ══ */}
                <section className="sticky-section mask-merge-up" style={{ background: '#0D0D0D', color: '#F5EDE3', position: 'relative', zIndex: 20, padding: isMobile ? '80px 0' : '120px 0' }}>
                    <div className="arch-grid-light parallax-layer" style={{ opacity: 0.3 }} data-speed="0.15" />

                    <div className="section-inner" style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: isMobile ? 40 : 80,
                        alignItems: 'center'
                    }}>
                        <h2 className="reveal-up" style={{ fontSize: isMobile ? '2.2rem' : 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, lineHeight: 1.1 }}>
                            Ground transport for Kenya&apos;s most demanding events.
                        </h2>
                        <div>
                            <p className="reveal-up stagger-1" style={{ fontSize: isMobile ? 16 : 19, lineHeight: 1.7, color: 'rgba(245,237,227,0.7)', fontWeight: 300, marginBottom: 24 }}>
                                From high-profile summits to corporate retreats, Swiftlink provides the logistical backbone for movement in Nairobi.
                            </p>
                            <p className="reveal-up stagger-1" style={{ fontSize: isMobile ? 16 : 19, lineHeight: 1.7, color: 'rgba(245,237,227,0.7)', fontWeight: 300 }}>
                                Transport where reliability, precision, and absolute discretion are engineered into the architecture.
                            </p>
                        </div>
                    </div>
                </section>

                {/* ══ Section 3: How it Works ══ */}
                <section id="how" className="sticky-section mask-merge-down" style={{ background: 'var(--bg-base)', position: 'relative', zIndex: 30, padding: isMobile ? '80px 0' : '120px 0' }}>
                    <div className="arch-grid parallax-layer" data-speed="0.25" />

                    <div className="section-inner" style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : '5fr 7fr',
                        gap: isMobile ? 48 : 64,
                        alignItems: 'center'
                    }}>
                        <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                            <h2 className="reveal-up" style={{ fontSize: isMobile ? '2rem' : 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, marginBottom: 16 }}>
                                The anatomy of a transfer.
                            </h2>
                            <p className="reveal-up" style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>
                                Simple by design. No account required. No apps.
                            </p>
                            {!isMobile && (
                                <div className="reveal-up stagger-1">
                                    {['Browser Tracking', 'Encrypted Relay', 'Data Erasure'].map(label => (
                                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                                            <div className="expand-line" />
                                            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: 10, opacity: 0.5 }}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="glass-card step-card reveal-up stagger-1" style={{ padding: isMobile ? '24px' : '28px 32px', borderRadius: isMobile ? '1.5rem' : '2.5rem', display: 'flex', gap: isMobile ? 16 : 24, alignItems: 'flex-start' }}>
                                <div className="step-number" style={{ width: isMobile ? 32 : 44, height: isMobile ? 32 : 44, fontSize: isMobile ? 14 : 18 }}>1</div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: isMobile ? 18 : 20, marginBottom: 4 }}>One Booking</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5 }}>Submit your request. A vetted driver is assigned instantly.</p>
                                </div>
                            </div>
                            <div className="glass-card step-card reveal-up stagger-2" style={{ padding: isMobile ? '24px' : '28px 32px', borderRadius: isMobile ? '1.5rem' : '2.5rem', display: 'flex', gap: isMobile ? 16 : 24, alignItems: 'flex-start' }}>
                                <div className="step-number" style={{ width: isMobile ? 32 : 44, height: isMobile ? 32 : 44, fontSize: isMobile ? 14 : 18 }}>2</div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: isMobile ? 18 : 20, marginBottom: 4 }}>One Secure Link</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5 }}>Encrypted link via email for tracking, chat, and status.</p>
                                </div>
                            </div>
                            <div className="glass-card step-card reveal-up stagger-3" style={{ padding: isMobile ? '24px' : '28px 32px', borderRadius: isMobile ? '1.5rem' : '2.5rem', display: 'flex', gap: isMobile ? 16 : 24, alignItems: 'flex-start' }}>
                                <div className="step-number" style={{ width: isMobile ? 32 : 44, height: isMobile ? 32 : 44, fontSize: isMobile ? 14 : 18 }}>3</div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: isMobile ? 18 : 20, marginBottom: 4 }}>Data Purged</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5 }}>Once arrived, links expire and logs are automatically wiped.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══ Section 4: Built Differently / Privacy ══ */}
                <section id="privacy" className="sticky-section mask-merge-up" style={{ background: '#ece6d9', position: 'relative', zIndex: 40, padding: isMobile ? '80px 0' : '120px 0' }}>
                    <div className="arch-grid parallax-layer" style={{ opacity: 0.4 }} data-speed="0.1" />

                    <div className="section-inner" style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: isMobile ? 48 : 80,
                        alignItems: 'center'
                    }}>
                        {/* Left */}
                        <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                            <h2 className="reveal-up" style={{ fontSize: isMobile ? '2rem' : 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, marginBottom: 16 }}>Built differently.</h2>
                            <p className="reveal-up" style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
                                Most transport coordination exposes more information than it needs to. Swiftlink minimizes the footprint at the architecture level.
                            </p>

                            {/* Features */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: isMobile ? 'center' : 'flex-start' }}>
                                <div className="reveal-up stagger-1" style={{ display: 'flex', gap: 16, textAlign: 'left', maxWidth: 400 }}>
                                    <div className="icon-tile glass-card" style={{ borderRadius: 16, width: 44, height: 44, flexShrink: 0 }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Privacy-first</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>Drivers never receive your contact details. They are structurally excluded.</p>
                                    </div>
                                </div>
                                <div className="reveal-up stagger-2" style={{ display: 'flex', gap: 16, textAlign: 'left', maxWidth: 400 }}>
                                    <div className="icon-tile glass-card" style={{ borderRadius: 16, width: 44, height: 44, flexShrink: 0 }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Records expire</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>Logs are wiped 24h after trip completion. No passenger profiles retained.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right — data lifecycle visualizer */}
                        <div className="reveal-up stagger-2" style={{ position: 'relative', width: '100%', maxWidth: 400, margin: '0 auto' }}>
                            <div className="glass-card-dark lifecycle-card" style={{
                                padding: isMobile ? 24 : 32, borderRadius: '2rem', position: 'relative', zIndex: 1,
                                opacity: lifecyclePhase === 2 ? 0.4 : 1,
                                transform: lifecyclePhase === 2 ? 'scale(0.97)' : 'scale(1)'
                            }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: '#F5EDE3', opacity: 0.9 }}>Data Lifecycle</span>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 9999,
                                        background: lifecyclePhase === 0 ? 'rgba(0,245,160,0.15)' : lifecyclePhase === 1 ? 'rgba(108,99,255,0.2)' : 'rgba(245,237,227,0.08)',
                                        color: lifecyclePhase === 0 ? 'var(--accent-success)' : lifecyclePhase === 1 ? 'var(--accent-primary)' : 'rgba(245,237,227,0.3)',
                                        transition: 'all 0.5s ease'
                                    }}>
                                        {lifecyclePhase === 0 ? 'IN TRANSIT' : lifecyclePhase === 1 ? 'PURGING' : 'WIPED'}
                                    </span>
                                </div>

                                {/* Session ID */}
                                <div style={{ borderLeft: `3px solid ${lifecyclePhase === 0 ? 'var(--accent-success)' : lifecyclePhase === 1 ? 'var(--accent-primary)' : 'rgba(245,237,227,0.1)'}`, paddingLeft: 12, marginBottom: 20, transition: 'border-color 0.5s ease' }}>
                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(245,237,227,0.4)', marginBottom: 4 }}>SESSION</div>
                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#F5EDE3' }}>sess_7f3a9b</div>
                                </div>

                                {/* Data fields */}
                                {[
                                    { label: 'Client', activeVal: '••••', purgedVal: '[REDACTED]', wipedVal: '—' },
                                    { label: 'Driver', activeVal: 'K. Mwangi', purgedVal: 'K. Mwangi', wipedVal: '—' },
                                    { label: 'Contact', activeVal: 'NEVER STORED', purgedVal: 'NEVER STORED', wipedVal: '—' },
                                ].map(field => (
                                    <div key={field.label} style={{
                                        display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                                        borderBottom: '1px solid rgba(245,237,227,0.06)',
                                        opacity: lifecyclePhase === 2 ? 0.2 : 1,
                                        transition: 'opacity 0.8s ease'
                                    }}>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(245,237,227,0.4)' }}>{field.label}</span>
                                        <span style={{
                                            fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                                            color: lifecyclePhase === 1 && field.label === 'Client' ? 'var(--accent-warning)' : '#F5EDE3',
                                            transition: 'color 0.5s ease'
                                        }}>
                                            {lifecyclePhase === 0 ? field.activeVal : lifecyclePhase === 1 ? field.purgedVal : field.wipedVal}
                                        </span>
                                    </div>
                                ))}

                                {/* TTL Bar */}
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(245,237,227,0.4)' }}>TTL</span>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, color: '#F5EDE3' }}>{lifecyclePhase === 0 ? sessionTime : lifecyclePhase === 1 ? '00:00:00' : '—'}</span>
                                    </div>
                                    <div className="ttl-bar-track" style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                                        <div className="ttl-bar" style={{ height: '100%', borderRadius: 2, background: 'var(--accent-primary)', width: lifecyclePhase === 0 ? '68%' : lifecyclePhase === 1 ? '0%' : '0%', transition: 'width 0.5s ease' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══ Section 5: Corporate ══ */}
                <section id="corporate" style={{ position: 'relative', zIndex: 50, background: 'var(--bg-base)', padding: isMobile ? '80px 0' : '120px 0 80px' }}>
                    <div className="arch-grid" style={{ position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none', zIndex: 0 }} />
                    <div className="section-inner">
                        {/* Top row */}
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: isMobile ? 32 : 64, gap: isMobile ? 12 : 48 }}>
                            <h2 className="reveal-up active" style={{ fontSize: isMobile ? '2.2rem' : 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, maxWidth: 600, lineHeight: 1.1 }}>
                                The standard for corporate leaders.
                            </h2>
                            <p className="reveal-up active" style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 300 }}>
                                Specialized ground transport for every scale.
                            </p>
                        </div>

                        {/* Service cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 24, marginBottom: isMobile ? 48 : 80 }}>
                            {[
                                {
                                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></svg>,
                                    title: 'Organizations',
                                    desc: 'Streamlined booking for executive staff. No operational overhead.',
                                    bullets: ['Board Retreats', 'VIP Delegations']
                                },
                                {
                                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>,
                                    title: 'MICE Planners',
                                    desc: 'Mass delegation coordination via a single dispatch view.',
                                    bullets: ['Batch Booking', 'Fleet Tracking']
                                },
                                {
                                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /></svg>,
                                    title: 'Travel Teams',
                                    desc: 'Direct integration and consolidated billing for management.',
                                    bullets: ['API Access', 'Consolidated Billing']
                                }
                            ].map((card, i) => (
                                <div key={card.title} className={`glass-card service-card reveal-up stagger-${i + 1}`} style={{ padding: isMobile ? 32 : 48, borderRadius: isMobile ? '2rem' : '3.5rem', display: 'flex', flexDirection: 'column', gap: 20, borderBottom: '4px solid rgba(13,13,13,0.06)' }}>
                                    <div style={{ width: 40, height: 40, background: '#0D0D0D', color: '#F5EDE3', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {card.icon}
                                    </div>
                                    <h4 style={{ fontWeight: 800, fontSize: 20 }}>{card.title}</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5 }}>{card.desc}</p>
                                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {card.bullets.map(b => (
                                            <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)' }} />
                                                {b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        {/* Contact form */}
                        <div className="glass-card reveal-up" style={{ padding: isMobile ? '48px 24px' : '64px 80px', borderRadius: isMobile ? '2.5rem' : '4rem', maxWidth: 900, margin: '0 auto' }}>
                            <h2 style={{ fontWeight: 800, fontSize: isMobile ? 28 : 36, marginBottom: 8, textAlign: 'center' }}>Corporate Accounts</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 15 : 18, textAlign: 'center', marginBottom: 32 }}>
                                Enquire for dedicated fleet support.
                            </p>

                            {!contactSent ? (
                                <form onSubmit={handleContactSubmit} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                                    <input className="glass-input" type="text" placeholder="Full Name" required value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} style={{ width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                    <input className="glass-input" type="text" placeholder="Company" required value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} style={{ width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                    <input className="glass-input" type="email" placeholder="Work Email" required value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} style={{ gridColumn: isMobile ? 'auto' : '1 / -1', width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                    <textarea className="glass-input" rows={3} placeholder="Message" required value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} style={{ gridColumn: isMobile ? 'auto' : '1 / -1', width: '100%', padding: '14px 18px', fontSize: 15, resize: 'none', outline: 'none' }} />
                                    <button type="submit" className="btn-premium btn-dark" style={{ gridColumn: isMobile ? 'auto' : '1 / -1', width: '100%', padding: 18, borderRadius: 14, fontSize: 16 }}>
                                        Send Enquiry ✓
                                    </button>
                                    {contactError && <p style={{ gridColumn: isMobile ? 'auto' : '1 / -1', color: '#D32F2F', fontSize: 14, margin: 0 }}>{contactError}</p>}
                                </form>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                    <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Received ✓</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>We will respond within 24 hours.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* ── Footer ── */}
            <footer style={{ background: '#111111', color: '#F5EDE3', position: 'relative', overflow: 'hidden', padding: isMobile ? '64px 24px' : '0' }}>
                {!isMobile && (
                    <div style={{
                        position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                        fontSize: 'clamp(6rem, 15vw, 14rem)', fontWeight: 900, letterSpacing: '-0.05em',
                        WebkitTextStroke: '1px rgba(245,237,227,0.03)', color: 'transparent',
                        whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', zIndex: 0
                    }}>SWIFTLINK</div>
                )}

                <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto' }}>
                    {/* Zone 1 — Upper content */}
                    <div style={{ padding: isMobile ? '0 0 48px' : '80px 80px 64px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr', gap: 48 }}>
                        {/* Column 1 — CTA */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)' }} />
                                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(245,237,227,0.4)' }}>Operational Hub</span>
                            </div>
                            <h2 className="kinetic-text" style={{ marginBottom: 24 }}>
                                <span style={{ fontSize: isMobile ? '2.5rem' : 'clamp(2.5rem, 5vw, 4rem)', display: 'block', color: '#F5EDE3' }}>Connect.</span>
                            </h2>
                            <p style={{ fontSize: 14, color: 'rgba(245,237,227,0.5)', lineHeight: 1.6, maxWidth: 320, marginBottom: 32 }}>
                                Design your movement framework with our Nairobi logistics team.
                            </p>
                            <a href="mailto:enquiry@swiftlink.co.ke" style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-primary)', textDecoration: 'none', borderBottom: '1px solid currentColor' }}>
                                enquiry@swiftlink.co.ke
                            </a>
                        </div>

                        {/* Additional Columns (Desktop Only) */}
                        {!isMobile && (
                            <>
                                <div />
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-primary)', marginBottom: 20 }}>Corporate</div>
                                    {['About', 'Security', 'Hub', 'Partners'].map(link => (
                                        <a key={link} href="#" style={{ display: 'block', color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: 14, marginBottom: 12 }}>{link}</a>
                                    ))}
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-primary)', marginBottom: 20 }}>Legal</div>
                                    {['Privacy', 'Data', 'Terms'].map(link => (
                                        <a key={link} href="#" style={{ display: 'block', color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: 14, marginBottom: 12 }}>{link}</a>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Zone 2 — Bottom strip */}
                    <div style={{ padding: isMobile ? '32px 0 0' : '32px 80px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', gap: 32 }}>
                        <div>
                            <div style={{ marginBottom: 12 }}>
                                <SwiftlinkLogo height={28} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(245,237,227,0.2)' }}>© 2026 Architectural Logistics Collective</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {['FB', 'X', 'IN'].map(social => (
                                <div key={social} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>{social}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
