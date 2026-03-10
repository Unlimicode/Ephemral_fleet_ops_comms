import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import GeoBackground from '../components/GeoBackground';
import '../styles/animations.css';

export default function SwiftlinkHomePage() {
    const navigate = useNavigate();
    const { isAuthenticated, role } = useAuth();

    const [form, setForm] = useState({
        fullName: '', email: '', pickup: '', destination: '',
        date: '', time: '', flight: '', special: ''
    });
    const [bookingState, setBookingState] = useState({ loading: false, success: false, error: null, email: '' });

    const [contactForm, setContactForm] = useState({
        name: '', company: '', email: '', message: ''
    });
    const [contactState, setContactState] = useState({ loading: false, success: false, error: null });

    useEffect(() => {
        if (isAuthenticated) {
            if (role === 'fleet_manager') navigate('/manager/dispatch');
            else if (role === 'driver') navigate('/driver/trips');
        }
    }, [isAuthenticated, role, navigate]);

    useEffect(() => {
        const observerOptions = {
            threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
            rootMargin: '0px'
        };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const section = entry.target;
                const ratio = entry.intersectionRatio;
                if (ratio > 0.1) {
                    section.querySelectorAll('.reveal-up').forEach(el => el.classList.add('active'));
                }
                if (ratio > 0) {
                    section.querySelectorAll('[data-merge-y]').forEach(target => {
                        const moveY = parseFloat(target.dataset.mergeY) || 0;
                        const rotate = parseFloat(target.dataset.mergeRotate) || 0;
                        const scaleBase = parseFloat(target.dataset.mergeScale) || 1;
                        const offset = (1 - ratio) * moveY;
                        const rotationOffset = (1 - ratio) * rotate;
                        const currentScale = 1 + (ratio * (scaleBase - 1));
                        target.style.transform = `translateY(${offset}px) rotate(${rotationOffset}deg) scale(${currentScale})`;
                    });
                    if (section.classList.contains('mask-merge-up')) {
                        const clipVal = 15 - (ratio * 15);
                        section.style.clipPath = `polygon(0 ${clipVal}%, 50% 0, 100% ${clipVal}%, 100% 100%, 0 100%)`;
                    }
                    if (section.classList.contains('mask-merge-down')) {
                        const clipVal = 85 + (ratio * 15);
                        section.style.clipPath = `polygon(0 0, 100% 0, 100% ${clipVal}%, 50% 100%, 0 ${clipVal}%)`;
                    }
                }
            });
        }, observerOptions);
        document.querySelectorAll('.sticky-section').forEach(s => observer.observe(s));
        return () => observer.disconnect();
    }, []);

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

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        if (!form.fullName || !form.email || !form.pickup || !form.destination || !form.date || !form.time) {
            setBookingState({ ...bookingState, error: 'Please fill in all required fields.' });
            return;
        }
        setBookingState({ ...bookingState, loading: true, error: null });
        try {
            const pickup_datetime = `${form.date}T${form.time}:00Z`;
            await api.post('/bookings', {
                client_name: form.fullName,
                client_corporate_email: form.email,
                pickup_location: form.pickup,
                destination: form.destination,
                pickup_datetime,
                flight_number: form.flight || null,
                special_requirements: form.special || null
            });
            setBookingState({ loading: false, success: true, error: null, email: form.email });
        } catch {
            setBookingState({ ...bookingState, loading: false, error: 'Failed to request transfer.' });
        }
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        if (!contactForm.name || !contactForm.company || !contactForm.email || !contactForm.message) {
            setContactState({ ...contactState, error: 'Please fill in all required fields.' });
            return;
        }
        setContactState({ ...contactState, loading: true, error: null });
        try {
            await api.post('/contact', contactForm);
            setContactState({ loading: false, success: true, error: null });
        } catch {
            setContactState({ ...contactState, loading: false, error: 'Failed to send inquiry.' });
        }
    };

    const fonts = { fontFamily: '"Inter", sans-serif' };
    const kineticHeading = { fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.85 };
    const outlineText = { WebkitTextStroke: '1.5px #0D0D0D', color: 'transparent' };
    const uppercaseLabel = { fontSize: '10px', fontWeight: 900, letterSpacing: '0.3em', opacity: 0.4, textTransform: 'uppercase' };

    const glassCard = {
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '0.5px solid rgba(255, 255, 255, 0.5)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
        borderRadius: '3.5rem'
    };

    return (
        <div style={{ ...fonts, backgroundColor: 'var(--bg-base)', minHeight: '100vh', position: 'relative' }}>
            <GeoBackground density="dense" fixed={true} />
            <style>{`
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        .glass-input {
          background: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 0.5px solid rgba(255, 255, 255, 0.4);
          border-radius: 1rem;
          padding: 1.25rem 1.25rem 1.25rem 1.25rem;
          transition: all 0.3s ease;
          width: 100%;
          box-sizing: border-box;
          outline: none;
          font-family: inherit;
        }
        .glass-input:focus {
          background: rgba(255, 255, 255, 0.6);
          border-color: var(--accent-primary);
        }
        .hover-lift { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .hover-lift:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); }
        .line-item-hover { transition: width 0.3s ease; }
        .line-item-container:hover .line-item-hover { width: 80px !important; }
      `}</style>

            {/* Removed inline Fixed Grid Background */}

            <nav className="glass-card" style={{
                position: 'fixed', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
                width: '90%', maxWidth: '1280px', zIndex: 100,
                borderRadius: '999px', padding: '1rem 2rem', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        backgroundColor: '#0D0D0D', color: '#F5EDE3',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontStyle: 'italic', fontSize: '1.2rem'
                    }}>S</div>
                    <span style={{ fontWeight: 900, fontSize: '1.5rem', letterSpacing: '-0.05em', color: '#0D0D0D' }}>swiftlink</span>
                </div>

                {/* Desktop Links */}
                <div style={{ display: 'none', gap: '2rem', alignItems: 'center', '@media(minWidth: 768px)': { display: 'flex' } }}>
                    <a href="#how-it-works" style={{ color: '#0D0D0D', textDecoration: 'none', fontWeight: 600 }}>How it works</a>
                    <a href="#built-differently" style={{ color: '#0D0D0D', textDecoration: 'none', fontWeight: 600 }}>Privacy</a>
                    <a href="#corporate" style={{ color: '#0D0D0D', textDecoration: 'none', fontWeight: 600 }}>Corporate</a>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <Link to="/login" style={{ color: '#6C63FF', textDecoration: 'none', fontWeight: 700 }}>Login</Link>
                    <a href="#booking-card" className="btn-premium btn-dark" style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '999px', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem'
                    }}>Book a Transfer</a>
                </div>
            </nav>

            {/* Section 1: Hero */}
            <section id="hero" className="sticky-section mask-merge-down" style={{ backgroundColor: 'var(--bg-base)', zIndex: 10, position: 'relative' }}>
                {/* Geometric Shapes */}
                <div className="animate-float" data-merge-y="120" style={{
                    position: 'absolute', top: '10%', right: '10%', zIndex: 0, pointerEvents: 'none', transform: 'scale(2) rotate(12deg)',
                    width: 0, height: 0, borderLeft: '150px solid transparent', borderRight: '150px solid transparent', borderBottom: '220px solid rgba(13,13,13,0.1)'
                }} />
                <div className="animate-float-slow" data-merge-y="-120" style={{
                    position: 'absolute', bottom: '10%', left: '5%', zIndex: 0, pointerEvents: 'none', transform: 'scale(1.5) rotate(-12deg)',
                    width: 0, height: 0, borderLeft: '150px solid transparent', borderRight: '150px solid transparent', borderBottom: '220px solid rgba(108,99,255,0.12)'
                }} />
                <div className="animate-morph-geo" style={{
                    position: 'absolute', top: '30%', left: '-5%', zIndex: 0, pointerEvents: 'none',
                    width: '320px', height: '320px', border: '55px solid rgba(13,13,13,0.08)'
                }} />

                <div style={{
                    width: '100%', maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '4rem', padding: '0 2rem', position: 'relative', zIndex: 1
                }}>
                    {/* Left Brand Content */}
                    <div className="reveal-up active" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ width: '48px', height: '2px', backgroundColor: '#0D0D0D' }} />
                            <span style={uppercaseLabel}>Kenya's Premier MICE Transport</span>
                        </div>

                        <h1 style={{ fontSize: 'clamp(4rem, 8vw, 7.5rem)', margin: '0 0 2rem 0', color: '#0D0D0D' }}>
                            <div style={{ ...kineticHeading, ...outlineText }}>Corporate transfers.</div>
                            <div style={kineticHeading}>Zero compromise.</div>
                        </h1>

                        <p style={{ fontSize: '1.25rem', color: '#6B6B6B', lineHeight: 1.6, maxWidth: '600px', marginBottom: '3rem' }}>
                            We connect organisations with vetted professional drivers for corporate transfers, airport pickups, conference shuttles, and executive travel. One booking, one secure link, one seamless transfer.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ ...glassCard, borderRadius: '999px', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#0D0D0D' }}>
                                <span style={{ color: 'var(--accent-primary)' }}>●</span> Privacy by Architecture
                            </div>
                            <div className="glass-card" style={{ borderRadius: '999px', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#0D0D0D' }}>
                                <span style={{ color: 'var(--accent-primary)' }}>●</span> Real-time Coordination
                            </div>
                        </div>
                    </div>

                    {/* Right Booking Form */}
                    <div id="booking-card" style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="reveal-up active stagger-1 glass-card animate-float-fast hover-lift" style={{ padding: '3rem', width: '100%' }}>
                            {!bookingState.success ? (
                                <>
                                    <h2 style={{ fontWeight: 900, fontSize: '2rem', letterSpacing: '-0.03em', color: '#0D0D0D', margin: '0 0 0.5rem 0' }}>Book a Transfer</h2>
                                    <p style={{ color: '#6B6B6B', fontSize: '0.9rem', marginBottom: '2rem' }}>No account required · Secure link sent to your inbox</p>

                                    <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <input type="text" placeholder="Full name" className="glass-input" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required />

                                        <div>
                                            <input type="email" placeholder="Corporate email" className="glass-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required style={{ marginBottom: '0.5rem' }} />
                                            <div style={{ fontSize: '0.8rem', color: '#6B6B6B', paddingLeft: '1rem' }}>Your magic link will be sent here</div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <input type="text" placeholder="Pickup location" className="glass-input" value={form.pickup} onChange={e => setForm({ ...form, pickup: e.target.value })} required />
                                            <input type="text" placeholder="Destination" className="glass-input" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} required />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <input type="date" className="glass-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                                            <input type="time" className="glass-input" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} required />
                                        </div>

                                        <input type="text" placeholder="Flight number (optional)" className="glass-input" value={form.flight} onChange={e => setForm({ ...form, flight: e.target.value })} />
                                        <textarea placeholder="Special requirements (optional)" className="glass-input" rows={3} value={form.special} onChange={e => setForm({ ...form, special: e.target.value })} style={{ resize: 'none' }} />

                                        {bookingState.error && <div style={{ color: '#E05A5A', fontSize: '0.9rem', textAlign: 'center' }}>{bookingState.error}</div>}

                                        <button type="submit" className="btn-premium btn-dark" style={{ marginTop: '1rem' }} disabled={bookingState.loading}>
                                            {bookingState.loading ? 'Processing...' : 'Request Transfer →'}
                                        </button>
                                        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#6B6B6B', marginTop: '0.5rem' }}>🔒 Protected by Mediated Ephemeral Identity</div>
                                    </form>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                                    <div style={{ fontSize: '4rem', color: 'var(--accent-primary)', marginBottom: '1rem' }}>✓</div>
                                    <h2 style={{ fontWeight: 900, fontSize: '2rem', color: '#0D0D0D', marginBottom: '1rem' }}>Booking Confirmed</h2>
                                    <p style={{ color: '#6B6B6B', lineHeight: 1.6 }}>A secure link has been sent to <strong>{bookingState.email}</strong>. Check your inbox.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 2: Introduction */}
            <section id="intro" className="sticky-section mask-merge-up" style={{ backgroundColor: '#0D0D0D', color: '#F5EDE3', zIndex: 20, position: 'relative' }}>
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
                    backgroundImage: `linear-gradient(to right, rgba(245,241,232,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,241,232,0.12) 1px, transparent 1px)`,
                    backgroundSize: '80px 80px'
                }} />

                <div className="animate-float-slow" data-merge-y="100" data-merge-rotate="60" style={{
                    position: 'absolute', top: '-10%', left: '-10%', zIndex: 0, pointerEvents: 'none', transform: 'scale(5) rotate(-45deg)',
                    width: 0, height: 0, borderLeft: '150px solid transparent', borderRight: '150px solid transparent', borderBottom: '220px solid rgba(255,255,255,0.08)'
                }} />
                <div className="animate-morph-geo" style={{
                    position: 'absolute', bottom: '-20%', right: '-10%', zIndex: 0, pointerEvents: 'none',
                    width: '500px', height: '500px', border: '80px solid rgba(108,99,255,0.12)'
                }} />

                <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '6fr 6fr', gap: '6rem', padding: '0 2rem', position: 'relative', zIndex: 1 }}>
                    <div className="reveal-up">
                        <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, margin: 0 }}>
                            Ground transport for Kenya's most demanding events.
                        </h2>
                    </div>
                    <div className="reveal-up stagger-1" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center' }}>
                        <p style={{ color: 'rgba(245,237,227,0.7)', fontSize: '1.25rem', fontWeight: 300, lineHeight: 1.8, margin: 0 }}>
                            From high-profile summits and diplomatic delegations to corporate board retreats, Swiftlink provides the logistical backbone for your movement in Nairobi and beyond.
                        </p>
                        <p style={{ color: 'rgba(245,237,227,0.7)', fontSize: '1.25rem', fontWeight: 300, lineHeight: 1.8, margin: 0 }}>
                            We connect your organisation with vetted professional drivers. Every booking is handled with precision, every delegate's contact details protected by architecture.
                        </p>
                    </div>
                </div>
            </section>

            <section id="how-it-works" className="sticky-section mask-merge-down" style={{ backgroundColor: 'var(--bg-base)', zIndex: 30, position: 'relative' }}>
                <div className="animate-float-slow" data-merge-scale="1.8" data-merge-y="-150" style={{
                    position: 'absolute', bottom: '10%', right: '5%', zIndex: 0, pointerEvents: 'none', transform: 'scale(3) rotate(180deg)',
                    width: 0, height: 0, borderLeft: '150px solid transparent', borderRight: '150px solid transparent', borderBottom: '220px solid rgba(13,13,13,0.08)'
                }} />
                <div className="animate-spin-slow" style={{
                    position: 'absolute', top: '10%', left: '10%', zIndex: 0, pointerEvents: 'none', transform: 'scale(2.2) rotate(90deg)',
                    width: 0, height: 0, borderLeft: '150px solid transparent', borderRight: '150px solid transparent', borderBottom: '220px solid rgba(108,99,255,0.08)'
                }} />

                <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '4rem', padding: '0 2rem', position: 'relative', zIndex: 1 }}>
                    <div className="reveal-up" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h2 style={{ ...kineticHeading, fontSize: '4rem', color: '#0D0D0D', margin: '0 0 1.5rem 0' }}>The anatomy of a transfer.</h2>
                        <p style={{ fontSize: '1.25rem', color: '#6B6B6B', lineHeight: 1.6, marginBottom: '3rem' }}>
                            Simple by design. No account creation. No app to download. Just seamless execution.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {["Browser-based Tracking", "Encrypted Relay Comms", "Automated Data Erasure"].map((item, i) => (
                                <div key={i} className="line-item-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'default' }}>
                                    <div className="line-item-hover" style={{ width: '48px', height: '2px', backgroundColor: '#0D0D0D' }} />
                                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0D0D0D' }}>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {[{ num: "1", title: "One Booking", desc: "Your coordinator submits the transfer request. We match you with a vetted professional from our network." },
                        { num: "2", title: "One Secure Link", desc: "Your delegate receives an encrypted link. Booking status, driver details, and a direct communication channel — all without exposing contact information." },
                        { num: "3", title: "Data Purged", desc: "When the trip ends, the link expires. Communication records are automatically deleted. No passenger profiles. No data residue." }
                        ].map((step, i) => (
                            <div key={i} className={`reveal-up hover-lift stagger-${i + 1} glass-card`} style={{ padding: '2.5rem', display: 'flex', gap: '1.5rem' }}>
                                <div style={{ width: '48px', height: '48px', backgroundColor: '#0D0D0D', color: '#F5EDE3', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.25rem', flexShrink: 0 }}>
                                    {step.num}
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 800, color: '#0D0D0D' }}>{step.title}</h3>
                                    <p style={{ margin: 0, color: '#6B6B6B', lineHeight: 1.6 }}>{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="built-differently" className="sticky-section mask-merge-up" style={{ backgroundColor: 'var(--bg-sand)', zIndex: 40, position: 'relative' }}>
                <div className="animate-spin-slow" data-merge-rotate="180" style={{
                    position: 'absolute', top: '5%', left: '50%', zIndex: 0, pointerEvents: 'none', transform: 'scale(1.8) rotate(45deg)',
                    width: 0, height: 0, borderLeft: '150px solid transparent', borderRight: '150px solid transparent', borderBottom: '220px solid rgba(108,99,255,0.2)'
                }} />
                <div className="animate-float" style={{
                    position: 'absolute', bottom: '10%', left: '10%', zIndex: 0, pointerEvents: 'none', transform: 'scale(2.5) rotate(-12deg)',
                    width: 0, height: 0, borderLeft: '150px solid transparent', borderRight: '150px solid transparent', borderBottom: '220px solid rgba(13,13,13,0.08)'
                }} />

                <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '6fr 6fr', gap: '5rem', padding: '0 2rem', position: 'relative', zIndex: 1 }}>
                    <div className="reveal-up" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h2 style={{ ...kineticHeading, fontSize: '4.5rem', color: '#0D0D0D', margin: '0 0 1.5rem 0' }}>Built differently.</h2>
                        <p style={{ fontSize: '1.25rem', color: '#6B6B6B', lineHeight: 1.6, marginBottom: '3rem' }}>
                            Most transport coordination exposes more information than it needs to. Swiftlink is engineered so that drivers receive exactly what they need to complete a transfer — and nothing beyond that.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div className="glass-card hover-lift" style={{ width: '64px', height: '64px', borderRadius: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.3s' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800, color: '#0D0D0D' }}>Contact details never transmitted</h3>
                                    <p style={{ margin: 0, color: '#6B6B6B', lineHeight: 1.5 }}>The driver interface is structurally incapable of displaying client contact information. It was never sent.</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div className="glass-card hover-lift" style={{ width: '64px', height: '64px', borderRadius: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.3s' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800, color: '#0D0D0D' }}>Records expire automatically</h3>
                                    <p style={{ margin: 0, color: '#6B6B6B', lineHeight: 1.5 }}>Communication records live in a temporary store with a countdown timer. After 24 hours with no complaint raised, everything is permanently deleted.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="reveal-up stagger-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: '10%', border: '4px solid rgba(13,13,13,0.08)', borderRadius: '4rem', transform: 'rotate(-3deg)' }} />
                        <div className="animate-float" style={{ position: 'absolute', inset: '5%', border: '4px solid rgba(13,13,13,0.08)', borderRadius: '4rem', transform: 'rotate(3deg)' }} />

                        <div style={{
                            width: '100%', aspectRatio: '16/9', background: 'rgba(13,13,13,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2.5rem', padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem',
                            fontFamily: 'monospace', fontSize: 'clamp(0.8rem, 1.5vw, 1.1rem)', zIndex: 1, position: 'relative'
                        }}>
                            <div style={{ color: '#4CAF50' }}>● Session active · Trip #4821 · TTL 01:42:33</div>
                            <div style={{ color: '#FFC107' }}>● Driver ↔ Client · Mediated relay · No PII</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)' }}>● On completion → data purged · Redis TTL fired</div>
                            <div style={{ position: 'absolute', bottom: '-2.5rem', left: 0, width: '100%', textAlign: 'center', fontStyle: 'italic', color: 'rgba(13,13,13,0.4)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Architecture of Connectivity
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="corporate" style={{ position: 'relative', zIndex: 50, backgroundColor: 'var(--bg-base)', paddingTop: '12rem', paddingBottom: '6rem' }}>
                <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', padding: '0 2rem' }}>

                    <div className="reveal-up" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4rem', gap: '2rem' }}>
                        <h2 style={{ ...kineticHeading, fontSize: '3.5rem', color: '#0D0D0D', margin: 0, maxWidth: '600px' }}>The standard for Kenya's corporate leaders.</h2>
                        <p style={{ margin: 0, fontSize: '1.25rem', color: '#6B6B6B', maxWidth: '400px' }}>Specialised solutions for every organisational scale.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '6rem' }}>
                        {[
                            { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>, title: "Organisations", desc: "Streamlined booking for executive staff and visiting partners. No overhead.", items: ["Board Retreats", "VIP Delegations"] },
                            { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>, title: "MICE Planners", desc: "Delegation coordination with real-time status across all vehicles and arrivals.", items: ["Conference Shuttles", "Airport Transfers"] },
                            { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>, title: "Travel Teams", desc: "Centralised management for travel coordinators handling recurring corporate accounts.", items: ["Recurring Bookings", "Consolidated Reporting"] }
                        ].map((card, i) => (
                            <div key={i} className={`reveal-up hover-lift stagger-${i + 1} glass-card`} style={{ padding: '3rem', borderRadius: '3.5rem' }}>
                                <div style={{ width: '56px', height: '56px', backgroundColor: '#0D0D0D', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                                    {card.icon}
                                </div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0D0D0D', margin: '0 0 1rem 0' }}>{card.title}</h3>
                                <p style={{ color: '#6B6B6B', lineHeight: 1.6, marginBottom: '2rem' }}>{card.desc}</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {card.items.map(item => (
                                        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#0D0D0D' }}>
                                            <span style={{ color: 'var(--accent-primary)' }}>●</span> {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="reveal-up active glass-card" style={{ borderRadius: '4rem', padding: '5rem', maxWidth: '800px', margin: '0 auto' }}>
                        {!contactState.success ? (
                            <>
                                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0D0D0D', margin: '0 0 0.5rem 0' }}>Corporate Accounts</h2>
                                    <p style={{ color: '#6B6B6B', fontSize: '1.1rem' }}>Get in touch about dedicated support.</p>
                                </div>

                                <form onSubmit={handleContactSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <input type="text" placeholder="Full Name" className="glass-input" value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} required />
                                    <input type="text" placeholder="Company" className="glass-input" value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} required />
                                    <input type="email" placeholder="Work Email" className="glass-input" style={{ gridColumn: '1 / -1' }} value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} required />
                                    <textarea placeholder="Message" className="glass-input" rows={4} style={{ gridColumn: '1 / -1', resize: 'none' }} value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} required />

                                    {contactState.error && <div style={{ gridColumn: '1 / -1', color: '#E05A5A', textAlign: 'center' }}>{contactState.error}</div>}

                                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                                        <button type="submit" className="btn-premium btn-dark" disabled={contactState.loading}>
                                            {contactState.loading ? 'Sending...' : 'Send Inquiry'}
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0D0D0D', marginBottom: '1rem' }}>Thank you.</h2>
                                <p style={{ color: '#6B6B6B', fontSize: '1.25rem' }}>We will be in touch.</p>
                            </div>
                        )}
                    </div>

                </div>
            </section>

            {/* Footer */}
            <footer style={{ backgroundColor: '#0D0D0D', color: '#F5EDE3', padding: '6rem 2rem', position: 'relative', zIndex: 100 }}>
                <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto' }}>

                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '4rem', marginBottom: '4rem' }}>
                        <div style={{ maxWidth: '300px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F5EDE3', color: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontStyle: 'italic', fontSize: '1rem' }}>S</div>
                                <span style={{ fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.05em' }}>swiftlink</span>
                            </div>
                            <p style={{ color: 'rgba(245,237,227,0.6)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                                Privacy-first fleet operations. The seamless movement of corporate leaders in Kenya.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '4rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ ...uppercaseLabel, color: '#F5EDE3' }}>Company</div>
                                <a href="#" style={{ color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}>About Us</a>
                                <a href="#" style={{ color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}>Safety</a>
                                <a href="#" style={{ color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}>Partners</a>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ ...uppercaseLabel, color: '#F5EDE3' }}>Legal</div>
                                <a href="#" style={{ color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}>Privacy</a>
                                <a href="#" style={{ color: 'rgba(245,237,227,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}>Terms</a>
                            </div>
                        </div>
                    </div>

                    <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(245,237,227,0.1)', marginBottom: '2rem' }} />

                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', ...uppercaseLabel, color: 'rgba(245,237,227,0.3)', opacity: 1 }}>
                        <div>Nairobi, Kenya</div>
                        <div>© 2026 Swiftlink. All rights reserved.</div>
                    </div>

                </div>
            </footer>
        </div>
    );
}
