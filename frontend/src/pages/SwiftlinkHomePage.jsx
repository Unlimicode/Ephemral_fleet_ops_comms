import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import '../styles/tokens.css';
import '../styles/animations.css';

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
    const [lifecyclePhase, setLifecyclePhase] = useState(0);
    const [sessionTime, setSessionTime] = useState('01:42:17');
    const [emailHover, setEmailHover] = useState(false);

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
                if (ratio > 0) {
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
            const scrolled = window.pageYOffset;
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
        } catch {
            setBookingStatus({ loading: false, success: false, error: 'Failed to request transfer.', email: '' });
        }
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/contact', contactForm);
            setContactSent(true);
        } catch {
            console.error('Contact error');
        }
    };

    return (
        <div style={{ background: 'var(--bg-base)', color: 'var(--text-dark)', fontFamily: 'Inter, sans-serif' }}>

            {/* ── Nav ── */}
            <nav style={{
                position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
                width: '90%', maxWidth: 1280, zIndex: 200,
                background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 9999,
                padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <img src="/swiftlink-icon.png" alt="Swiftlink" style={{ height: 36, width: 36, borderRadius: 8 }} />
                    <span style={{ fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.8px', marginLeft: 10 }}>Swiftlink</span>
                </div>
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
            </nav>

            {/* ── Main ── */}
            <main style={{ position: 'relative' }}>

                {/* ══ Section 1: Hero ══ */}
                <section className="sticky-section mask-merge-down" style={{ background: 'var(--bg-base)', position: 'relative', zIndex: 10 }}>
                    <div className="arch-grid parallax-layer" data-speed="0.2" />
                    <div className="geo-shape" style={{ top: '15%', right: '8%', color: 'rgba(13,13,13,0.12)' }}>
                        <div className="geo-triangle animate-float-slow" style={{ transform: 'rotate(12deg) scale(2)' }} />
                    </div>
                    <div className="geo-shape" style={{ bottom: '10%', left: '6%', color: 'rgba(108,99,255,0.12)' }}>
                        <div className="geo-triangle animate-float-reverse" style={{ transform: 'rotate(-15deg) scale(1.5)' }} />
                    </div>

                    <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 64, alignItems: 'center', paddingTop: 96 }}>
                        {/* Left column */}
                        <div>
                            <div className="reveal-up active">
                                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3em', opacity: 0.4 }}>
                                    — Kenya&apos;s Premier MICE Transport
                                </span>
                            </div>
                            <h1 className="kinetic-text reveal-up active" style={{ fontSize: 'clamp(3rem, 8vw, 7rem)', margin: '24px 0' }}>
                                <span className="outline-text">Corporate transfers.</span>
                                <span style={{ display: 'block', marginTop: 16 }}>Zero compromise.</span>
                            </h1>
                            <p className="reveal-up active" style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 500, margin: '32px 0 40px' }}>
                                Privacy-first ground transport for international business travellers. Your contact details are never shared with drivers.
                            </p>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <div className="glass-card reveal-up active stagger-1" style={{ padding: '8px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 600 }}>🔒 Privacy by Architecture</div>
                                <div className="glass-card reveal-up active stagger-1" style={{ padding: '8px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 600 }}>⚡ Real-time Coordination</div>
                                <div className="glass-card reveal-up active stagger-1" style={{ padding: '8px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 600 }}>✈️ Flight Tracking</div>
                            </div>
                        </div>

                        {/* Right column — booking form */}
                        <div className="glass-card reveal-up active stagger-2" style={{ padding: 40, borderRadius: '3rem' }}>
                            {!bookingStatus.success ? (
                                <>
                                    <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Book a Transfer</h2>
                                    <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div>
                                                <label className="form-label">Full Name</label>
                                                <input className="glass-input" type="text" required value={bookingForm.client_first_name} onChange={e => setBookingForm({ ...bookingForm, client_first_name: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, outline: 'none' }} />
                                            </div>
                                            <div>
                                                <label className="form-label">Corporate Email</label>
                                                <input className="glass-input" type="email" required value={bookingForm.client_corporate_email} onChange={e => setBookingForm({ ...bookingForm, client_corporate_email: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, outline: 'none' }} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div>
                                                <label className="form-label">Pickup Location</label>
                                                <input className="glass-input" type="text" required value={bookingForm.pickup_location} onChange={e => setBookingForm({ ...bookingForm, pickup_location: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, outline: 'none' }} />
                                            </div>
                                            <div>
                                                <label className="form-label">Destination</label>
                                                <input className="glass-input" type="text" required value={bookingForm.destination} onChange={e => setBookingForm({ ...bookingForm, destination: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, outline: 'none' }} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div>
                                                <label className="form-label">Date</label>
                                                <input className="glass-input" type="date" required value={bookingForm.date} onChange={e => setBookingForm({ ...bookingForm, date: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, outline: 'none' }} />
                                            </div>
                                            <div>
                                                <label className="form-label">Time</label>
                                                <input className="glass-input" type="time" required value={bookingForm.time} onChange={e => setBookingForm({ ...bookingForm, time: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, outline: 'none' }} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="form-label">Flight Number (Optional)</label>
                                            <input className="glass-input" type="text" value={bookingForm.flight_number} onChange={e => setBookingForm({ ...bookingForm, flight_number: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, outline: 'none' }} />
                                        </div>
                                        <div>
                                            <label className="form-label">Special Requirements (Optional)</label>
                                            <textarea className="glass-input" rows={2} value={bookingForm.special_requirements} onChange={e => setBookingForm({ ...bookingForm, special_requirements: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, resize: 'none', outline: 'none' }} />
                                        </div>
                                        <button type="submit" disabled={bookingStatus.loading} className="btn-premium btn-dark" style={{ width: '100%', padding: 16, borderRadius: 12, marginTop: 8, fontSize: 15, letterSpacing: '0.1em' }}>
                                            {bookingStatus.loading ? 'Processing...' : 'Request Transfer →'}
                                        </button>
                                        {bookingStatus.error && <p style={{ fontSize: 13, color: 'var(--accent-warning)', textAlign: 'center' }}>{bookingStatus.error}</p>}
                                    </form>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                    <div style={{ fontSize: 48, color: 'var(--accent-success)', marginBottom: 16 }}>✓</div>
                                    <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Booking Confirmed</h2>
                                    <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                                        A secure link has been sent to <strong>{bookingStatus.email}</strong>. Use it to track your transfer and communicate with your driver.
                                    </p>
                                    <button onClick={() => setBookingStatus({ ...bookingStatus, success: false })} style={{ marginTop: 24, background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}>Book another</button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ══ Section 2: Intro ══ */}
                <section className="sticky-section mask-merge-up" style={{ background: '#0D0D0D', color: '#F5EDE3', position: 'relative', zIndex: 20 }}>
                    <div className="arch-grid-light parallax-layer" style={{ opacity: 0.3 }} data-speed="0.15" />
                    <div className="geo-shape animate-spin-slow" style={{ top: '-10%', left: '20%', color: 'rgba(255,255,255,0.05)' }}>
                        <div className="geo-triangle" style={{ transform: 'scale(5) rotate(-45deg)' }} />
                    </div>

                    <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
                        <h2 className="reveal-up" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, lineHeight: 1.1 }}>
                            Ground transport for Kenya&apos;s most demanding events.
                        </h2>
                        <div>
                            <p className="reveal-up stagger-1" style={{ fontSize: 20, lineHeight: 1.7, color: 'rgba(245,237,227,0.7)', fontWeight: 300, marginBottom: 32 }}>
                                From high-profile summits and diplomatic delegations to corporate board retreats, Swiftlink provides the logistical backbone for ground movement in Nairobi and beyond.
                            </p>
                            <p className="reveal-up stagger-1" style={{ fontSize: 20, lineHeight: 1.7, color: 'rgba(245,237,227,0.7)', fontWeight: 300 }}>
                                At this level, transport is not just about A to B — it is about reliability, precision, and absolute discretion. Our system is engineered for the journeys where failure is not an option.
                            </p>
                        </div>
                    </div>
                </section>

                {/* ══ Section 3: How it Works ══ */}
                <section id="how" className="sticky-section mask-merge-down" style={{ background: 'var(--bg-base)', position: 'relative', zIndex: 30 }}>
                    <div className="arch-grid parallax-layer" data-speed="0.25" />
                    <div className="geo-shape animate-float" style={{ bottom: 0, right: 0, color: 'rgba(13,13,13,0.08)' }}>
                        <div className="geo-triangle" style={{ transform: 'scale(3) rotate(180deg)' }} />
                    </div>
                    <div className="geo-shape animate-spin-slow" style={{ top: 0, left: '-5%', color: 'rgba(108,99,255,0.08)' }}>
                        <div className="geo-triangle" style={{ transform: 'scale(2.2) rotate(90deg)' }} />
                    </div>

                    <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 64, alignItems: 'center' }}>
                        <div>
                            <h2 className="reveal-up" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, marginBottom: 24 }}>
                                The anatomy of a transfer.
                            </h2>
                            <p className="reveal-up" style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 40 }}>
                                Simple by design. No account required. No app to download.
                            </p>
                            <div className="reveal-up stagger-1">
                                {['Browser-based Tracking', 'Encrypted Relay Comms', 'Automated Data Erasure'].map(label => (
                                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                                        <div className="expand-line" />
                                        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: 11, opacity: 0.5 }}>{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div className="glass-card step-card reveal-up stagger-1" style={{ padding: '28px 32px', borderRadius: '2.5rem', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                                <div className="step-number">1</div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>One Booking</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.5 }}>Submit your transfer request. A vetted driver is assigned from our network.</p>
                                </div>
                            </div>
                            <div className="glass-card step-card reveal-up stagger-2" style={{ padding: '28px 32px', borderRadius: '2.5rem', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                                <div className="step-number">2</div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>One Secure Link</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.5 }}>Receive an encrypted magic link via corporate email. Booking status, tracking, and driver chat are built in.</p>
                                </div>
                            </div>
                            <div className="glass-card step-card reveal-up stagger-3" style={{ padding: '28px 32px', borderRadius: '2.5rem', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                                <div className="step-number">3</div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Data Purged</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.5 }}>Once you arrive, your link expires. Communication records are automatically wiped from the system.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══ Section 4: Built Differently / Privacy ══ */}
                <section id="privacy" className="sticky-section mask-merge-up" style={{ background: '#ece6d9', position: 'relative', zIndex: 40 }}>
                    <div className="arch-grid parallax-layer" style={{ opacity: 0.4 }} data-speed="0.1" />
                    {/* Edge triangles — subtle, non-competing */}
                    <div className="geo-shape animate-float-slow" style={{ top: '5%', right: '3%', color: 'rgba(108,99,255,0.08)' }}>
                        <div className="geo-triangle-sm" style={{ transform: 'rotate(25deg)' }} />
                    </div>
                    <div className="geo-shape animate-float" style={{ bottom: '8%', left: '4%', color: 'rgba(13,13,13,0.06)' }}>
                        <div className="geo-triangle-sm" style={{ transform: 'rotate(-18deg)' }} />
                    </div>
                    <div className="geo-shape animate-spin-slow" style={{ top: '60%', right: '15%', color: 'rgba(108,99,255,0.05)' }}>
                        <div className="geo-triangle-xs" style={{ transform: 'rotate(70deg)' }} />
                    </div>

                    <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
                        {/* Left */}
                        <div>
                            <h2 className="reveal-up" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, marginBottom: 20 }}>Built differently.</h2>
                            <p className="reveal-up" style={{ fontSize: 20, color: 'var(--text-secondary)', marginBottom: 48, lineHeight: 1.6 }}>
                                Most transport coordination exposes more information than it needs to. Swiftlink is engineered to minimize the footprint at the architecture level.
                            </p>

                            {/* Feature 1 */}
                            <div className="reveal-up stagger-1" style={{ display: 'flex', gap: 24, marginBottom: 40 }}>
                                <div className="icon-tile glass-card" style={{ borderRadius: 24 }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        <path d="m9 12 2 2 4-4" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Privacy-first focus</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.5 }}>Drivers never receive your phone number or email. Contact details are structurally excluded.</p>
                                </div>
                            </div>

                            {/* Feature 2 */}
                            <div className="reveal-up stagger-2" style={{ display: 'flex', gap: 24, marginBottom: 40 }}>
                                <div className="icon-tile glass-card" style={{ borderRadius: 24 }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Records expire</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.5 }}>Communication logs are wiped 24 hours after trip completion. No passenger profiles are retained.</p>
                                </div>
                            </div>
                        </div>

                        {/* Right — data lifecycle visualizer */}
                        <div className="reveal-up stagger-2" style={{ position: 'relative' }}>
                            {/* Morphing circle behind card */}
                            <div className="animate-morph" style={{
                                position: 'absolute', width: '120%', height: '120%', top: '-10%', left: '-10%',
                                background: 'rgba(108,99,255,0.06)', borderRadius: '40% 60% 70% 30% / 40% 50% 60% 70%',
                                zIndex: 0, pointerEvents: 'none'
                            }} />

                            <div className="glass-card-dark lifecycle-card" style={{
                                padding: 32, borderRadius: '2rem', position: 'relative', zIndex: 1,
                                opacity: lifecyclePhase === 2 ? 0.4 : 1,
                                transform: lifecyclePhase === 2 ? 'scale(0.97)' : 'scale(1)'
                            }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#F5EDE3', opacity: 0.9 }}>Data Lifecycle</span>
                                    <span style={{
                                        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 9999,
                                        background: lifecyclePhase === 0 ? 'rgba(0,245,160,0.15)' : lifecyclePhase === 1 ? 'rgba(108,99,255,0.2)' : 'rgba(245,237,227,0.08)',
                                        color: lifecyclePhase === 0 ? 'var(--accent-success)' : lifecyclePhase === 1 ? 'var(--accent-primary)' : 'rgba(245,237,227,0.3)',
                                        transition: 'all 0.5s ease'
                                    }}>
                                        {lifecyclePhase === 0 ? 'IN TRANSIT' : lifecyclePhase === 1 ? 'PURGING' : 'WIPED'}
                                    </span>
                                </div>

                                {/* Session ID */}
                                <div style={{ borderLeft: `3px solid ${lifecyclePhase === 0 ? 'var(--accent-success)' : lifecyclePhase === 1 ? 'var(--accent-primary)' : 'rgba(245,237,227,0.1)'}`, paddingLeft: 16, marginBottom: 20, transition: 'border-color 0.5s ease' }}>
                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(245,237,227,0.4)', marginBottom: 4 }}>SESSION</div>
                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#F5EDE3' }}>sess_7f3a9b</div>
                                </div>

                                {/* Data fields */}
                                {[
                                    { label: 'Client', activeVal: '••••', purgedVal: '[REDACTED]', wipedVal: '—' },
                                    { label: 'Driver', activeVal: 'K. Mwangi', purgedVal: 'K. Mwangi', wipedVal: '—' },
                                    { label: 'Contact', activeVal: 'NEVER STORED', purgedVal: 'NEVER STORED', wipedVal: '—' },
                                ].map(field => (
                                    <div key={field.label} style={{
                                        display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                                        borderBottom: '1px solid rgba(245,237,227,0.06)',
                                        opacity: lifecyclePhase === 2 ? 0.2 : 1,
                                        transition: 'opacity 0.8s ease'
                                    }}>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(245,237,227,0.4)' }}>{field.label}</span>
                                        <span style={{
                                            fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
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
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(245,237,227,0.4)' }}>TTL</span>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: '#F5EDE3' }}>{lifecyclePhase === 0 ? sessionTime : lifecyclePhase === 1 ? '00:00:00' : '—'}</span>
                                    </div>
                                    <div className="ttl-bar-track">
                                        <div className="ttl-bar" style={{ width: lifecyclePhase === 0 ? '68%' : lifecyclePhase === 1 ? '0%' : '0%' }} />
                                    </div>
                                </div>

                                {/* Wiped state overlay */}
                                {lifecyclePhase === 2 && (
                                    <div style={{
                                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        borderRadius: '2rem', border: '1px dashed rgba(245,237,227,0.15)',
                                        background: 'rgba(13,13,13,0.6)', backdropFilter: 'blur(4px)', zIndex: 2
                                    }}>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(245,237,227,0.35)', textAlign: 'center', lineHeight: 1.6 }}>
                                            No records exist<br />for this session
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Phase indicator */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginTop: 24, position: 'relative', zIndex: 1 }}>
                                {['Active', 'Complete', 'Purged'].map((label, i) => (
                                    <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                            <span style={{
                                                width: 8, height: 8, borderRadius: '50%',
                                                background: lifecyclePhase === i ? 'var(--accent-primary)' : 'rgba(13,13,13,0.15)',
                                                transition: 'background 0.4s ease',
                                                boxShadow: lifecyclePhase === i ? '0 0 8px rgba(108,99,255,0.4)' : 'none'
                                            }} />
                                            <span style={{
                                                fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
                                                textTransform: 'uppercase', letterSpacing: '0.15em',
                                                color: lifecyclePhase === i ? 'var(--text-dark)' : 'var(--text-secondary)',
                                                opacity: lifecyclePhase === i ? 1 : 0.4,
                                                transition: 'opacity 0.4s ease, color 0.4s ease'
                                            }}>{label}</span>
                                        </div>
                                        {i < 2 && <div style={{ width: 40, height: 1, background: 'rgba(13,13,13,0.12)', margin: '0 12px', marginBottom: 18 }} />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══ Section 5: Corporate ══ */}
                <section id="corporate" style={{ position: 'relative', zIndex: 50, background: 'var(--bg-base)', padding: '120px 0 80px' }}>
                    <div className="arch-grid" style={{ position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none', zIndex: 0 }} />
                    <div className="geo-shape animate-float-slow" style={{ top: '5%', right: '5%', color: 'rgba(13,13,13,0.05)' }}>
                        <div className="geo-triangle" style={{ transform: 'scale(2) rotate(20deg)' }} />
                    </div>
                    <div className="geo-shape animate-spin-slow" style={{ bottom: '10%', left: '3%', color: 'rgba(108,99,255,0.06)' }}>
                        <div className="geo-triangle-sm" style={{ transform: 'rotate(-30deg)' }} />
                    </div>

                    <div className="section-inner">
                        {/* Top row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 64, gap: 48 }}>
                            <h2 className="reveal-up active" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, maxWidth: 600, lineHeight: 1.1 }}>
                                The standard for Kenya&apos;s corporate leaders.
                            </h2>
                            <p className="reveal-up active" style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 300 }}>
                                Specialized ground transport for every organisational scale.
                            </p>
                        </div>

                        {/* Service cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, marginBottom: 80 }}>
                            {[
                                {
                                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 22V12h6v10" /><path d="M3 9h18" /></svg>,
                                    title: 'Organizations',
                                    desc: 'Streamlined booking for executive staff and visiting partners. No operational overhead.',
                                    bullets: ['Board Retreats', 'VIP Delegations']
                                },
                                {
                                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
                                    title: 'MICE Planners',
                                    desc: 'Mass delegation coordination via a single dispatch view. Real-time assignment manifests.',
                                    bullets: ['Batch Booking', 'Fleet Tracking']
                                },
                                {
                                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
                                    title: 'Travel Teams',
                                    desc: 'Direct integration and consolidated billing for travel management companies.',
                                    bullets: ['API Access', 'Consolidated Invoicing']
                                }
                            ].map((card, i) => (
                                <div key={card.title} className={`glass-card service-card reveal-up stagger-${i + 1}`} style={{ padding: 48, borderRadius: '3.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderBottom: '4px solid rgba(13,13,13,0.06)' }}>
                                    <div style={{ width: 40, height: 40, background: '#0D0D0D', color: '#F5EDE3', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, transition: 'transform 0.3s ease' }}>
                                        {card.icon}
                                    </div>
                                    <h4 style={{ fontWeight: 800, fontSize: 22, marginBottom: 12 }}>{card.title}</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.5, marginBottom: 32 }}>{card.desc}</p>
                                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {card.bullets.map(b => (
                                            <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-secondary)' }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                                                {b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        {/* Contact form */}
                        <div className="glass-card reveal-up" style={{ padding: '64px 80px', borderRadius: '4rem', position: 'relative', overflow: 'hidden', maxWidth: 900, margin: '0 auto' }}>
                            <div style={{ position: 'absolute', top: -40, right: -40, color: 'rgba(108,99,255,0.1)' }}>
                                <div className="geo-triangle animate-spin-slow" style={{ transform: 'scale(2)' }} />
                            </div>
                            <h2 style={{ fontWeight: 800, fontSize: 36, marginBottom: 8, textAlign: 'center', position: 'relative', zIndex: 1 }}>Corporate Accounts</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 18, textAlign: 'center', marginBottom: 48, position: 'relative', zIndex: 1 }}>
                                Get in touch with our events team for dedicated fleet support.
                            </p>

                            {!contactSent ? (
                                <form onSubmit={handleContactSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, position: 'relative', zIndex: 1 }}>
                                    <div>
                                        <label className="form-label">Full Name</label>
                                        <input className="glass-input" type="text" required value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label className="form-label">Company</label>
                                        <input className="glass-input" type="text" required value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, outline: 'none' }} />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Work Email</label>
                                        <input className="glass-input" type="email" required value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, outline: 'none' }} />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Message</label>
                                        <textarea className="glass-input" rows={4} required value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} style={{ width: '100%', padding: '16px 20px', fontSize: 16, resize: 'none', outline: 'none' }} />
                                    </div>
                                    <button type="submit" className="btn-premium btn-dark" style={{ gridColumn: '1 / -1', width: '100%', padding: 20, borderRadius: 16, fontSize: 18, letterSpacing: '0.1em' }}>
                                        Send Enquiry →
                                    </button>
                                </form>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 0', position: 'relative', zIndex: 1 }}>
                                    <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
                                    <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Thank you</h3>
                                    <p style={{ color: 'var(--text-secondary)' }}>Our events team will review your enquiry and respond within 24 hours.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* ── Footer ── */}
            <footer style={{ background: '#111111', color: '#F5EDE3', position: 'relative', overflow: 'hidden' }}>
                {/* Background watermark */}
                <div style={{
                    position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 'clamp(6rem, 15vw, 14rem)', fontWeight: 900, letterSpacing: '-0.05em',
                    WebkitTextStroke: '1px rgba(245,237,227,0.03)', color: 'transparent',
                    whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', zIndex: 0
                }}>SWIFTLINK</div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Zone 1 — Upper content */}
                    <div style={{ padding: '80px 80px 64px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48 }}>
                        {/* Column 1 — CTA */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgba(245,237,227,0.4)' }}>Operational Readiness</span>
                            </div>
                            <h2 className="kinetic-text" style={{ marginBottom: 32 }}>
                                <span className="outline-text-light" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', display: 'block' }}>Start the</span>
                                <span style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', display: 'block', color: '#F5EDE3' }}>Conversation.</span>
                            </h2>
                            <p style={{ fontSize: 15, color: 'rgba(245,237,227,0.5)', lineHeight: 1.6, maxWidth: 320, marginBottom: 40 }}>
                                Connect with our logistics team to design your next movement framework.
                            </p>
                            <div
                                style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                                onMouseEnter={() => setEmailHover(true)}
                                onMouseLeave={() => setEmailHover(false)}
                            >
                                <div style={{
                                    width: 52, height: 52, borderRadius: '50%',
                                    border: `1px solid ${emailHover ? 'var(--accent-primary)' : 'rgba(245,237,227,0.2)'}`,
                                    background: emailHover ? 'var(--accent-primary)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    transition: 'all 0.3s ease',
                                    transform: emailHover ? 'scale(1.05)' : 'scale(1)'
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F5EDE3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                        <polyline points="12 5 19 12 12 19" />
                                    </svg>
                                </div>
                                <a href="mailto:enquiry@swiftlink.co.ke" style={{ fontWeight: 700, fontSize: 18, color: '#F5EDE3', textDecoration: 'none', borderBottom: '1px solid rgba(245,237,227,0.3)', paddingBottom: 2 }}>
                                    enquiry@swiftlink.co.ke
                                </a>
                            </div>
                        </div>

                        {/* Column 2 — spacer */}
                        <div />

                        {/* Column 3 — Corporate */}
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent-primary)', marginBottom: 24 }}>Corporate</div>
                            {['About Us', 'Security Architecture', 'Operational Hub', 'Partnerships'].map(link => (
                                <a key={link} href="#" style={{ display: 'block', color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: 15, fontWeight: 500, marginBottom: 16, transition: 'color 0.2s' }}>{link}</a>
                            ))}
                        </div>

                        {/* Column 4 — Regulatory */}
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent-primary)', marginBottom: 24 }}>Regulatory</div>
                            {['Privacy Protocol', 'Data Governance', 'Terms of Service'].map(link => (
                                <a key={link} href="#" style={{ display: 'block', color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: 15, fontWeight: 500, marginBottom: 16, transition: 'color 0.2s' }}>{link}</a>
                            ))}
                        </div>
                    </div>

                    {/* Divider */}
                    <hr style={{ border: 'none', borderTop: '1px solid rgba(245,237,227,0.08)', margin: '0 80px' }} />

                    {/* Zone 2 — Bottom strip */}
                    <div style={{ padding: '32px 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* Left — logo + operational tags */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <div style={{ width: 32, height: 32, background: '#F5EDE3', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 16, color: '#0D0D0D' }}>S</span>
                                </div>
                                <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.5px', color: '#F5EDE3' }}>swiftlink</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(245,237,227,0.25)' }}>01. Fleet Dispatch / Nairobi</span>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(245,237,227,0.25)' }}>02. Relay Comms / Encrypted</span>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(245,237,227,0.25)' }}>03. Data Purged / By Design</span>
                            </div>
                        </div>

                        {/* Right — social + copyright */}
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 12 }}>
                                {/* Facebook */}
                                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(245,237,227,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', cursor: 'pointer' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(245,237,227,0.5)"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                </div>
                                {/* Twitter/X */}
                                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(245,237,227,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', cursor: 'pointer' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(245,237,227,0.5)"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                </div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(245,237,227,0.2)' }}>© 2026 Architectural Logistics Collective</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
