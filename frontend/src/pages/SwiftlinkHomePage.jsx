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
    const [width, setWidth] = useState(window.innerWidth);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [helpRole, setHelpRole] = useState('client');

    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

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
    }, [isMobile]);

    useEffect(() => {
        const handler = () => {
            document.querySelectorAll('.parallax-layer[data-speed]').forEach(layer => {
                const speed = parseFloat(layer.getAttribute('data-speed')) || 0;
                layer.style.transform = `translateY(${window.scrollY * speed}px)`;
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
        const advance = () => { phase = (phase + 1) % 3; setLifecyclePhase(phase); };
        let timeout = setTimeout(advance, durations[0]);
        const cycle = () => { timeout = setTimeout(() => { advance(); cycle(); }, durations[phase]); };
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
            setBookingForm({ client_first_name: '', client_corporate_email: '', pickup_location: '', destination: '', date: '', time: '', flight_number: '', special_requirements: '' });
        } catch {
            setBookingStatus({ loading: false, success: false, error: 'Failed to submit booking. Please try again.', email: '' });
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
        <>
        <div style={{ background: 'var(--bg-base)', color: 'var(--text-dark)', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>

            {/* ── Nav ── */}
            <nav style={{
                position: 'fixed', top: isMobile ? 12 : 24, left: '50%', transform: 'translateX(-50%)',
                width: isMobile ? '94%' : '90%', maxWidth: 1280, zIndex: 200,
                background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 9999,
                padding: isMobile ? '12px 20px' : '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SwiftlinkLogo height={isMobile ? 28 : 36} />
                    <span style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 900, fontSize: isMobile ? '15px' : '18px', letterSpacing: '-0.03em', color: '#0D0D0D' }}>SwiftLink</span>
                </div>
                {isMobile ? (
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>
                        <div style={{ width: 24, height: 2, background: 'var(--text-dark)', marginBottom: 5, borderRadius: 2 }} />
                        <div style={{ width: 24, height: 2, background: 'var(--text-dark)', marginBottom: 5, borderRadius: 2 }} />
                        <div style={{ width: 16, height: 2, background: 'var(--text-dark)', marginLeft: 'auto', borderRadius: 2 }} />
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {['How it works', 'Privacy', 'Corporate'].map((label, i) => (
                            <a key={label} href={['#how', '#privacy', '#corporate'][i]} style={{
                                color: 'inherit', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                                padding: '8px 18px', borderRadius: 9999, background: 'rgba(255,255,255,0.5)',
                                border: '1px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)', transition: 'background 0.2s ease, transform 0.2s ease'
                            }}>{label}</a>
                        ))}
                        <Link to="/login" style={{
                            color: '#F5EDE3', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                            padding: '8px 18px', borderRadius: 9999, background: 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)', transition: 'background 0.2s ease'
                        }}>Login</Link>
                    </div>
                )}
            </nav>

            {/* ── Mobile Menu ── */}
            {isMobile && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 300, visibility: mobileMenuOpen ? 'visible' : 'hidden', pointerEvents: mobileMenuOpen ? 'auto' : 'none' }}>
                    <div onClick={() => setMobileMenuOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,13,0.3)', backdropFilter: 'blur(8px)', opacity: mobileMenuOpen ? 1 : 0, transition: 'opacity 0.4s' }} />
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
                        gap: isMobile ? 48 : 64, alignItems: 'center', paddingTop: isMobile ? 88 : 160
                    }}>
                        {/* Left */}
                        <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                            <div className="reveal-up active">
                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3em', opacity: 0.4 }}>
                                    — Corporate Ground Transport, Nairobi
                                </span>
                            </div>
                            <h1 className="kinetic-text reveal-up active" style={{ fontSize: isMobile ? '3.2rem' : 'clamp(3.5rem, 8vw, 7rem)', margin: '16px 0', lineHeight: 1 }}>
                                <span className={`${!isMobile ? 'outline-text' : ''}`}>Corporate transfers.</span>
                                <span style={{ display: 'block', marginTop: 12 }}>Zero compromise.</span>
                            </h1>
                            <p className="reveal-up active" style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: isMobile ? 'none' : 500, margin: '24px auto 40px' }}>
                                Executive and delegate transport for Nairobi&apos;s corporate sector. Your number never touches a driver&apos;s phone.
                            </p>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                <div className="glass-card reveal-up active stagger-1" style={{ padding: '8px 16px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>🔒 KDPA Compliant</div>
                                <div className="glass-card reveal-up active stagger-1" style={{ padding: '8px 16px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>⚡ Real-time Dispatch</div>
                            </div>
                        </div>

                        {/* Right — Booking Form */}
                        <div className="glass-card reveal-up active stagger-2" style={{ padding: isMobile ? '32px 24px' : 40, borderRadius: isMobile ? '2rem' : '3rem', maxWidth: 500, margin: '0 auto', width: '100%' }}>
                            {!bookingStatus.success ? (
                                <>
                                    <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Request a Transfer</h2>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>No account needed. Confirmation goes to your inbox.</p>
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
                                            {bookingStatus.loading ? 'Submitting…' : 'Request Transfer →'}
                                        </button>
                                        {bookingStatus.error && <p style={{ fontSize: 12, color: 'var(--accent-warning)', textAlign: 'center' }}>{bookingStatus.error}</p>}
                                    </form>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                                    <div style={{ fontSize: 40, color: 'var(--accent-success)', marginBottom: 12 }}>✓</div>
                                    <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Transfer Requested</h2>
                                    <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                                        Your secure trip link has been sent to <strong>{bookingStatus.email}</strong>. Check your inbox — it contains your driver info and live tracking.
                                    </p>
                                    <button onClick={() => setBookingStatus({ ...bookingStatus, success: false })} style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Submit another booking</button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ══ Section 2: Intro ══ */}
                <section className="sticky-section mask-merge-up" style={{ background: '#0D0D0D', color: '#F5EDE3', position: 'relative', zIndex: 20, padding: isMobile ? '80px 0' : '120px 0' }}>
                    <div className="arch-grid-light parallax-layer" style={{ opacity: 0.3 }} data-speed="0.15" />
                    <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 40 : 80, alignItems: 'center' }}>
                        <h2 className="reveal-up" style={{ fontSize: isMobile ? '2.2rem' : 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, lineHeight: 1.1 }}>
                            Built for the gap no fleet app wanted to fix.
                        </h2>
                        <div>
                            <p className="reveal-up stagger-1" style={{ fontSize: isMobile ? 16 : 19, lineHeight: 1.7, color: 'rgba(245,237,227,0.7)', fontWeight: 300, marginBottom: 24 }}>
                                Every fleet tool on the market tracks vehicles. None of them protected your delegates after the trip ended. Drivers kept numbers. Clients got unwanted calls. The problem was architectural.
                            </p>
                            <p className="reveal-up stagger-1" style={{ fontSize: isMobile ? 16 : 19, lineHeight: 1.7, color: 'rgba(245,237,227,0.7)', fontWeight: 300 }}>
                                SwiftLink fixes the coordination layer — not with policy, but with structure. Drivers work through an encrypted relay. Your contact details are never in the system.
                            </p>
                        </div>
                    </div>
                </section>

                {/* ══ Section 3: How it Works ══ */}
                <section id="how" className="sticky-section mask-merge-down" style={{ background: 'var(--bg-base)', position: 'relative', zIndex: 30, padding: isMobile ? '80px 0' : '120px 0' }}>
                    <div className="arch-grid parallax-layer" data-speed="0.25" />
                    <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : '5fr 7fr', gap: isMobile ? 48 : 64, alignItems: 'center' }}>
                        <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                            <h2 className="reveal-up" style={{ fontSize: isMobile ? '2rem' : 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, marginBottom: 16 }}>
                                The anatomy of a transfer.
                            </h2>
                            <p className="reveal-up" style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>
                                Three steps. No app install. No account setup.
                            </p>
                            {!isMobile && (
                                <div className="reveal-up stagger-1">
                                    {['No-contact Dispatch', 'Encrypted Relay', 'Automatic Erasure'].map(label => (
                                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                                            <div className="expand-line" />
                                            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: 10, opacity: 0.5 }}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {[
                                {
                                    n: 1,
                                    title: 'Submit a Request',
                                    desc: 'Enter your pickup details and corporate email. A verified SwiftLink driver is assigned by dispatch — not matched by algorithm.'
                                },
                                {
                                    n: 2,
                                    title: 'Receive Your Secure Link',
                                    desc: 'A one-time encrypted link arrives in your inbox. Track your driver, message dispatch, and monitor trip status — no app, no account required.'
                                },
                                {
                                    n: 3,
                                    title: 'Session Closed. Records Gone.',
                                    desc: 'When your trip completes, the session expires immediately. All identifiers are purged within 24 hours — enforced at the infrastructure level, not by policy.'
                                }
                            ].map((step, i) => (
                                <div key={step.n} className={`glass-card step-card reveal-up stagger-${i + 1}`} style={{ padding: isMobile ? '24px' : '28px 32px', borderRadius: isMobile ? '1.5rem' : '2.5rem', display: 'flex', gap: isMobile ? 16 : 24, alignItems: 'flex-start' }}>
                                    <div className="step-number" style={{ width: isMobile ? 32 : 44, height: isMobile ? 32 : 44, fontSize: isMobile ? 14 : 18 }}>{step.n}</div>
                                    <div>
                                        <h4 style={{ fontWeight: 800, fontSize: isMobile ? 18 : 20, marginBottom: 4 }}>{step.title}</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5 }}>{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══ Section 4: Privacy ══ */}
                <section id="privacy" className="sticky-section mask-merge-up" style={{ background: '#ece6d9', position: 'relative', zIndex: 40, padding: isMobile ? '80px 0' : '120px 0' }}>
                    <div className="arch-grid parallax-layer" style={{ opacity: 0.4 }} data-speed="0.1" />
                    <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 48 : 80, alignItems: 'center' }}>
                        <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                            <h2 className="reveal-up" style={{ fontSize: isMobile ? '2rem' : 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, marginBottom: 16 }}>Built differently.</h2>
                            <p className="reveal-up" style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
                                Consumer ride-hailing treats data retention as a feature. We treat it as a liability. SwiftLink is engineered so that when a trip ends, there is nothing left to expose.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: isMobile ? 'center' : 'flex-start' }}>
                                <div className="reveal-up stagger-1" style={{ display: 'flex', gap: 16, textAlign: 'left', maxWidth: 400 }}>
                                    <div className="icon-tile glass-card" style={{ borderRadius: 16, width: 44, height: 44, flexShrink: 0 }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Structurally private</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>Your mobile number is never entered, stored, or transmitted. Drivers coordinate through an encrypted relay that expires with the trip.</p>
                                    </div>
                                </div>
                                <div className="reveal-up stagger-2" style={{ display: 'flex', gap: 16, textAlign: 'left', maxWidth: 400 }}>
                                    <div className="icon-tile glass-card" style={{ borderRadius: 16, width: 44, height: 44, flexShrink: 0 }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Records expire automatically</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>Session data is destroyed 24 hours after completion — automatically, not manually. No passenger profiles. No communication history. Nothing to breach.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Data lifecycle visualizer */}
                        <div className="reveal-up stagger-2" style={{ position: 'relative', width: '100%', maxWidth: 400, margin: '0 auto' }}>
                            <div className="glass-card-dark lifecycle-card" style={{
                                padding: isMobile ? 24 : 32, borderRadius: '2rem', position: 'relative', zIndex: 1,
                                opacity: lifecyclePhase === 2 ? 0.4 : 1,
                                transform: lifecyclePhase === 2 ? 'scale(0.97)' : 'scale(1)'
                            }}>
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
                                <div style={{ borderLeft: `3px solid ${lifecyclePhase === 0 ? 'var(--accent-success)' : lifecyclePhase === 1 ? 'var(--accent-primary)' : 'rgba(245,237,227,0.1)'}`, paddingLeft: 12, marginBottom: 20, transition: 'border-color 0.5s ease' }}>
                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(245,237,227,0.4)', marginBottom: 4 }}>SESSION</div>
                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#F5EDE3' }}>sess_7f3a9b</div>
                                </div>
                                {[
                                    { label: 'Client', activeVal: '••••', purgedVal: '[REDACTED]', wipedVal: '—' },
                                    { label: 'Driver', activeVal: 'K. Mwangi', purgedVal: 'K. Mwangi', wipedVal: '—' },
                                    { label: 'Contact', activeVal: 'NEVER STORED', purgedVal: 'NEVER STORED', wipedVal: '—' },
                                ].map(field => (
                                    <div key={field.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(245,237,227,0.06)', opacity: lifecyclePhase === 2 ? 0.2 : 1, transition: 'opacity 0.8s ease' }}>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(245,237,227,0.4)' }}>{field.label}</span>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: lifecyclePhase === 1 && field.label === 'Client' ? 'var(--accent-warning)' : '#F5EDE3', transition: 'color 0.5s ease' }}>
                                            {lifecyclePhase === 0 ? field.activeVal : lifecyclePhase === 1 ? field.purgedVal : field.wipedVal}
                                        </span>
                                    </div>
                                ))}
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(245,237,227,0.4)' }}>TTL</span>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, color: '#F5EDE3' }}>{lifecyclePhase === 0 ? sessionTime : lifecyclePhase === 1 ? '00:00:00' : '—'}</span>
                                    </div>
                                    <div className="ttl-bar-track" style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                                        <div className="ttl-bar" style={{ height: '100%', borderRadius: 2, background: 'var(--accent-primary)', width: lifecyclePhase === 0 ? '68%' : '0%', transition: 'width 0.5s ease' }} />
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
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: isMobile ? 32 : 64, gap: isMobile ? 12 : 48 }}>
                            <h2 className="reveal-up active" style={{ fontSize: isMobile ? '2.2rem' : 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, maxWidth: 600, lineHeight: 1.1 }}>
                                Transport infrastructure for teams that move.
                            </h2>
                            <p className="reveal-up active" style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 300 }}>
                                From a single executive transfer to a 200-delegate summit fleet.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 24, marginBottom: isMobile ? 48 : 80 }}>
                            {[
                                {
                                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></svg>,
                                    title: 'Organizations',
                                    desc: 'Your EA books a transfer in under two minutes. No vendor calls, no WhatsApp threads. Confirmation and trip tracking go directly to the traveller.',
                                    bullets: ['Board Retreats', 'Executive Transfers']
                                },
                                {
                                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>,
                                    title: 'MICE Planners',
                                    desc: 'Coordinate 50 airport pickups from one dashboard. Assign drivers, monitor live status, and manage last-minute changes — without a single WhatsApp group.',
                                    bullets: ['Batch Booking', 'Live Fleet View']
                                },
                                {
                                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /></svg>,
                                    title: 'Travel Teams',
                                    desc: 'One point of contact for all ground transport across your travel programme. Consolidated records, compliance-ready exports, and a dedicated account manager.',
                                    bullets: ['Consolidated Billing', 'Compliance Exports']
                                }
                            ].map((card, i) => (
                                <div key={card.title} className={`glass-card service-card reveal-up stagger-${i + 1}`} style={{ padding: isMobile ? 32 : 48, borderRadius: isMobile ? '2rem' : '3.5rem', display: 'flex', flexDirection: 'column', gap: 20, borderBottom: '4px solid rgba(13,13,13,0.06)' }}>
                                    <div style={{ width: 40, height: 40, background: '#0D0D0D', color: '#F5EDE3', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
                                    <h4 style={{ fontWeight: 800, fontSize: 20 }}>{card.title}</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5 }}>{card.desc}</p>
                                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {card.bullets.map(b => (
                                            <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />{b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        {/* Contact Form */}
                        <div className="glass-card reveal-up" style={{ padding: isMobile ? '48px 24px' : '64px 80px', borderRadius: isMobile ? '2.5rem' : '4rem', maxWidth: 900, margin: '0 auto' }}>
                            <h2 style={{ fontWeight: 800, fontSize: isMobile ? 28 : 36, marginBottom: 8, textAlign: 'center' }}>Set Up a Corporate Account</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 15 : 18, textAlign: 'center', marginBottom: 32 }}>
                                Tell us about your team&apos;s transport needs. We&apos;ll follow up within one business day.
                            </p>
                            {!contactSent ? (
                                <form onSubmit={handleContactSubmit} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                                    <input className="glass-input" type="text" placeholder="Full Name" required value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} style={{ width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                    <input className="glass-input" type="text" placeholder="Company" required value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} style={{ width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                    <input className="glass-input" type="email" placeholder="Work Email" required value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} style={{ gridColumn: isMobile ? 'auto' : '1 / -1', width: '100%', padding: '14px 18px', fontSize: 15, outline: 'none' }} />
                                    <textarea className="glass-input" rows={3} placeholder="Tell us about your team's transport volume, event types, or any specific requirements." required value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} style={{ gridColumn: isMobile ? 'auto' : '1 / -1', width: '100%', padding: '14px 18px', fontSize: 15, resize: 'none', outline: 'none' }} />
                                    <button type="submit" className="btn-premium btn-dark" style={{ gridColumn: isMobile ? 'auto' : '1 / -1', width: '100%', padding: 18, borderRadius: 14, fontSize: 16 }}>
                                        Send Enquiry →
                                    </button>
                                    {contactError && <p style={{ gridColumn: isMobile ? 'auto' : '1 / -1', color: '#D32F2F', fontSize: 14, margin: 0 }}>{contactError}</p>}
                                </form>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                    <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                                    <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Enquiry Received</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>We&apos;ll be in touch within one business day. In the meantime, you can reach us directly at <a href="mailto:enquiry@swiftlink.co.ke" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>enquiry@swiftlink.co.ke</a>.</p>
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
                    <div style={{ padding: isMobile ? '0 0 48px' : '80px 80px 64px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr', gap: 48 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)' }} />
                                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(245,237,227,0.4)' }}>Nairobi Operations</span>
                            </div>
                            <h2 className="kinetic-text" style={{ marginBottom: 24 }}>
                                <span style={{ fontSize: isMobile ? '2.5rem' : 'clamp(2.5rem, 5vw, 4rem)', display: 'block', color: '#F5EDE3' }}>Let&apos;s talk.</span>
                            </h2>
                            <p style={{ fontSize: 14, color: 'rgba(245,237,227,0.5)', lineHeight: 1.6, maxWidth: 320, marginBottom: 32 }}>
                                Talk to our Nairobi dispatch team about corporate rates, fleet capacity, and MICE event contracts.
                            </p>
                            <a href="mailto:enquiry@swiftlink.co.ke" style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-primary)', textDecoration: 'none', borderBottom: '1px solid currentColor' }}>
                                enquiry@swiftlink.co.ke
                            </a>
                        </div>
                        {!isMobile && (
                            <>
                                <div />
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-primary)', marginBottom: 20 }}>Platform</div>
                                    {[
                                        { label: 'How it Works', href: '#how' },
                                        { label: 'Privacy', href: '#privacy' },
                                        { label: 'Corporate', href: '#corporate' },
                                        { label: 'Manager Login', href: '/login' },
                                    ].map(link => (
                                        <a key={link.label} href={link.href} style={{ display: 'block', color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: 14, marginBottom: 12 }}>{link.label}</a>
                                    ))}
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-primary)', marginBottom: 20 }}>Legal</div>
                                    {[
                                        { label: 'Privacy Policy', href: '#privacy' },
                                        { label: 'Data Handling', href: '#privacy' },
                                        { label: 'Terms of Use', href: '#' },
                                    ].map(link => (
                                        <a key={link.label} href={link.href} style={{ display: 'block', color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: 14, marginBottom: 12 }}>{link.label}</a>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <div style={{ padding: isMobile ? '32px 0 0' : '32px 80px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', gap: 32 }}>
                        <div>
                            <div style={{ marginBottom: 12 }}><SwiftlinkLogo height={28} /></div>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(245,237,227,0.2)' }}>© 2026 SwiftLink Kenya</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {[
                                { label: 'LI', href: 'https://linkedin.com' },
                                { label: 'X', href: 'https://x.com' },
                            ].map(s => (
                                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>{s.label}</a>
                            ))}
                        </div>
                    </div>
                </div>
            </footer>
        </div>

        {/* Floating help button */}
        <button
            onClick={() => setHelpOpen(true)}
            className="help-pill help-pill-float"
            style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50, border: 'none' }}
        >
            ? Help
        </button>

        {/* Landing help modal */}
        {helpOpen && (
            <>
                <div onClick={() => setHelpOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 199, transition: 'opacity 0.25s ease' }} />
                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: 'rgba(245,237,227,0.97)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(0,0,0,0.15)' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 0' }}>
                        <div>
                            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0D0D0D', letterSpacing: '-0.02em' }}>SwiftLink User Guide</div>
                            <div style={{ fontSize: '11px', color: '#6B6B6B', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>How it works for each role</div>
                        </div>
                        <button onClick={() => setHelpOpen(false)} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px', color: '#6B6B6B' }}>×</button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', padding: '12px 20px 0' }}>
                        {[['client','Client'],['manager','Fleet Manager'],['driver','Driver']].map(([k,l]) => (
                            <button key={k} onClick={() => setHelpRole(k)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: helpRole === k ? '#6C63FF' : 'rgba(0,0,0,0.05)', color: helpRole === k ? '#fff' : '#6B6B6B', transition: 'all 0.2s ease' }}>{l}</button>
                        ))}
                    </div>
                    <div style={{ overflowY: 'auto', padding: '16px 20px 40px', flex: 1, fontSize: '13px', color: '#3D3D3D', lineHeight: 1.7 }}>
                        {helpRole === 'client' && (<>
                            <p style={{ fontWeight: 700, color: '#0D0D0D', margin: '0 0 10px' }}>Corporate Trip Clients</p>
                            <p style={{ margin: '0 0 10px' }}>You are a corporate traveller booked by your fleet manager. You do <strong>not</strong> need to create an account — access arrives in your email.</p>
                            <div style={{ paddingLeft: '14px', borderLeft: '2px solid rgba(108,99,255,0.3)', marginBottom: '14px' }}>
                                <div style={{ marginBottom: '6px' }}>• Your fleet manager creates the booking and you receive an email with a secure one-click link.</div>
                                <div style={{ marginBottom: '6px' }}>• Click the link to open your personal trip dashboard — route, driver details, vehicle, and live chat.</div>
                                <div style={{ marginBottom: '6px' }}>• Communicate with your driver via the <strong>Secure Channel</strong> during the journey.</div>
                                <div>• After drop-off you have <strong>24 hours</strong> to file a complaint if needed. Then all data is deleted.</div>
                            </div>
                            <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderLeft: '3px solid #6C63FF', borderRadius: '8px', padding: '10px 14px' }}><span style={{ fontWeight: 700, color: '#6C63FF' }}>Privacy: </span>Your phone number and surname are never stored or visible to your driver. Only your first name is shared.</div>
                        </>)}
                        {helpRole === 'manager' && (<>
                            <p style={{ fontWeight: 700, color: '#0D0D0D', margin: '0 0 10px' }}>Fleet Managers</p>
                            <p style={{ margin: '0 0 10px' }}>You operate the dispatch dashboard. Sign in via <strong>magic link</strong> — enter your work email and click the link in your inbox.</p>
                            <div style={{ paddingLeft: '14px', borderLeft: '2px solid rgba(108,99,255,0.3)', marginBottom: '14px' }}>
                                <div style={{ marginBottom: '6px' }}>• Create bookings for corporate clients from the <strong>Dispatch</strong> page.</div>
                                <div style={{ marginBottom: '6px' }}>• Assign drivers and vehicles, set ETAs, and monitor trips in real time.</div>
                                <div style={{ marginBottom: '6px' }}>• Manage your driver roster — add, deactivate, or reactivate drivers.</div>
                                <div style={{ marginBottom: '6px' }}>• Handle complaints through the investigation lifecycle from the <strong>Complaints</strong> page.</div>
                                <div>• Export compliance reports (PDF) and full audit logs (CSV) from the <strong>Audit</strong> page.</div>
                            </div>
                            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderLeft: '3px solid #F59E0B', borderRadius: '8px', padding: '10px 14px' }}><span style={{ fontWeight: 700, color: '#F59E0B' }}>Access: </span>Go to the <strong>Login page</strong> and enter your work email. A sign-in link arrives within seconds — no password needed.</div>
                        </>)}
                        {helpRole === 'driver' && (<>
                            <p style={{ fontWeight: 700, color: '#0D0D0D', margin: '0 0 10px' }}>Drivers</p>
                            <p style={{ margin: '0 0 10px' }}>Your account is created by your fleet manager. Sign in with the <strong>work email and password</strong> from your account setup email.</p>
                            <div style={{ paddingLeft: '14px', borderLeft: '2px solid rgba(108,99,255,0.3)', marginBottom: '14px' }}>
                                <div style={{ marginBottom: '6px' }}>• View assigned trips, accept or decline with a reason, and start journeys from the <strong>Trips</strong> page.</div>
                                <div style={{ marginBottom: '6px' }}>• Communicate with your client via the <strong>Secure Channel</strong> — no phone numbers exchanged.</div>
                                <div style={{ marginBottom: '6px' }}>• Mark trips complete when the client is safely dropped off. Your session is immediately wiped.</div>
                                <div>• Enable <strong>push notifications</strong> from your Profile page to receive trip alerts in the background.</div>
                            </div>
                            <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderLeft: '3px solid #6C63FF', borderRadius: '8px', padding: '10px 14px' }}><span style={{ fontWeight: 700, color: '#6C63FF' }}>Privacy: </span>The client never sees your phone number. Only your first name and vehicle details are shared with them.</div>
                        </>)}
                    </div>
                </div>
            </>
        )}
        </>
    );
}
