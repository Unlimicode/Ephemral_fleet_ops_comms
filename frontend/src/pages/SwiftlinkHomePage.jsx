import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

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

    useEffect(() => {
        if (isAuthenticated) {
            if (role === 'fleet_manager') navigate('/manager/dispatch');
            else if (role === 'driver') navigate('/driver/trips');
        }
    }, [isAuthenticated, role, navigate]);

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
        <div style={{ background: 'var(--bg-base)', color: 'var(--text-dark)', minHeight: '100vh' }}>

            {/* Background Blobs */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                <div className="glass-blob" style={{ position: 'absolute', width: '600px', height: '600px', bottom: '-10%', left: '-5%', background: 'radial-gradient(circle, rgba(240,180,140,0.6) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'blobFloat1 20s infinite alternate' }} />
                <div className="glass-blob" style={{ position: 'absolute', width: '400px', height: '400px', top: '10%', right: '10%', background: 'radial-gradient(circle, rgba(140,180,240,0.4) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'blobFloat2 25s infinite alternate' }} />
            </div>

            {/* Navigation */}
            <nav style={{ padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'absolute', top: 0, width: '100%', zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/swiftlink-icon.png" alt="S" style={{ height: '32px' }} />
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.8px' }}>wiftlink</span>
                </div>
                <div style={{ display: 'flex', gap: '32px', fontSize: '14px', fontWeight: 600 }}>
                    <a href="#how" style={{ color: 'inherit', textDecoration: 'none' }}>How it works</a>
                    <a href="#privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</a>
                    <a href="#corporate" style={{ color: 'inherit', textDecoration: 'none' }}>Corporate</a>
                    <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Login</Link>
                </div>
            </nav>

            {/* Section 1: Hero */}
            <section style={{ height: '100vh', display: 'flex', padding: '0 80px', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{ flex: 1, paddingRight: '40px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px' }}>— Kenya's Premier MICE Transport</span>
                    <h1 style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, margin: '24px 0', letterSpacing: '-3px' }}>
                        <span style={{ WebkitTextStroke: '2px var(--text-dark)', color: 'transparent' }}>Corporate transfers.</span><br />
                        <span>Zero compromise.</span>
                    </h1>
                    <p style={{ fontSize: '18px', lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: '500px', marginBottom: '40px' }}>
                        Privacy-first ground transport for international business travellers. Your contact details are never shared with drivers.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '48px' }}>
                        <div className="glass-card" style={{ padding: '8px 16px', borderRadius: '50px', fontSize: '13px', fontWeight: 600 }}>🔒 Privacy by Architecture</div>
                        <div className="glass-card" style={{ padding: '8px 16px', borderRadius: '50px', fontSize: '13px', fontWeight: 600 }}>⚡ Real-time Coordination</div>
                        <div className="glass-card" style={{ padding: '8px 16px', borderRadius: '50px', fontSize: '13px', fontWeight: 600 }}>✈️ Flight Tracking</div>
                    </div>
                    <div style={{ opacity: 0.4, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Trusted by leading organisations
                    </div>
                </div>

                <div style={{ width: '460px' }}>
                    <div className="glass-card" style={{ padding: '32px', borderRadius: '32px', boxShadow: '0 24px 64px rgba(0,0,0,0.1)' }}>
                        {!bookingStatus.success ? (
                            <>
                                <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px' }}>Book a Transfer</h2>
                                <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <input type="text" placeholder="Full name" required value={bookingForm.client_first_name} onChange={e => setBookingForm({ ...bookingForm, client_first_name: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }} />
                                        <input type="email" placeholder="Corporate email" required value={bookingForm.client_corporate_email} onChange={e => setBookingForm({ ...bookingForm, client_corporate_email: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <input type="text" placeholder="Pickup location" required value={bookingForm.pickup_location} onChange={e => setBookingForm({ ...bookingForm, pickup_location: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }} />
                                        <input type="text" placeholder="Destination" required value={bookingForm.destination} onChange={e => setBookingForm({ ...bookingForm, destination: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <input type="date" required value={bookingForm.date} onChange={e => setBookingForm({ ...bookingForm, date: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }} />
                                        <input type="time" required value={bookingForm.time} onChange={e => setBookingForm({ ...bookingForm, time: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }} />
                                    </div>
                                    <input type="text" placeholder="Flight number (Optional)" value={bookingForm.flight_number} onChange={e => setBookingForm({ ...bookingForm, flight_number: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }} />
                                    <textarea placeholder="Special requirements (Optional)" rows={2} value={bookingForm.special_requirements} onChange={e => setBookingForm({ ...bookingForm, special_requirements: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', resize: 'none' }} />
                                    <button type="submit" disabled={bookingStatus.loading} className="glass-button" style={{ padding: '14px', borderRadius: '12px', fontWeight: 700, marginTop: '8px' }}>
                                        {bookingStatus.loading ? 'Processing...' : 'Request Transfer →'}
                                    </button>
                                    {bookingStatus.error && <p style={{ fontSize: '13px', color: 'var(--accent-warning)', textAlign: 'center' }}>{bookingStatus.error}</p>}
                                </form>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <div style={{ fontSize: '48px', color: 'var(--accent-success)', marginBottom: '16px' }}>✓</div>
                                <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Booking Confirmed</h2>
                                <p style={{ fontSize: '15px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                                    A secure link has been sent to <strong>{bookingStatus.email}</strong>. Use it to track your transfer and communicate with your driver.
                                </p>
                                <button onClick={() => setBookingStatus({ ...bookingStatus, success: false })} style={{ marginTop: '24px', background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}>Book another</button>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Section 2: How it works */}
            <section id="how" style={{ padding: '100px 80px', background: 'rgba(255,255,255,0.3)', position: 'relative', zIndex: 1 }}>
                <h2 style={{ textAlign: 'center', fontSize: '40px', fontWeight: 800, marginBottom: '64px' }}>How it works</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
                    {[
                        { step: '1', title: '📋 Book', desc: 'Submit your transfer request with your corporate email. No account required.' },
                        { step: '2', title: '🔗 Get your link', desc: "Receive a secure magic link. It's valid for the duration of your trip." },
                        { step: '3', title: '🚗 Travel securely', desc: 'Communicate with your driver through our mediated channel. Your contact details stay private.' }
                    ].map(s => (
                        <div key={s.step} className="glass-card" style={{ padding: '32px', borderRadius: '24px', height: '100%' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '12px', display: 'block' }}>STEP 0{s.step}</span>
                            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>{s.title}</h3>
                            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Section 3: Privacy Guarantee */}
            <section id="privacy" style={{ padding: '80px', background: 'rgba(13,13,13,0.92)', color: '#F5EDE3', backdropFilter: 'blur(40px)', position: 'relative', zIndex: 1 }}>
                <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '64px', textAlign: 'center' }}>Privacy protected at the architecture level</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '48px', marginBottom: '64px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🚫</div>
                        <p style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.4 }}>Drivers never receive your phone number or email</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏱️</div>
                        <p style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.4 }}>Communication records expire automatically after your trip</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '16px' }}>📋</div>
                        <p style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.4 }}>Full audit trail available for corporate compliance</p>
                    </div>
                </div>
                <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
                    Compliant with Kenya Data Protection Act 2019, Section 25
                </div>
            </section>

            {/* Section 4: Corporate Accounts */}
            <section id="corporate" style={{ padding: '100px 80px', position: 'relative', zIndex: 1 }}>
                <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', padding: '64px', borderRadius: '40px', background: 'rgba(255,245,230,0.4)' }}>
                    <div>
                        <h2 style={{ fontSize: '40px', fontWeight: 800, marginBottom: '24px' }}>MICE & Corporate Travel</h2>
                        <p style={{ fontSize: '17px', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: '32px' }}>
                            We specialize in end-to-end ground transport logistics for large-scale corporate events and high-profile international delegations.
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {['VIP airport transfers', 'Conference shuttles', 'Multi-day event logistics', 'Diplomatic delegate transport'].map(item => (
                                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                                    <span style={{ color: 'var(--accent-primary)' }}>✓</span> {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        {!contactSent ? (
                            <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Get in touch</h3>
                                <input type="text" placeholder="Name" required value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.6)' }} />
                                <input type="text" placeholder="Company" required value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.6)' }} />
                                <input type="email" placeholder="Work email" required value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.6)' }} />
                                <textarea placeholder="Message" rows={4} required value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.6)', resize: 'none' }} />
                                <button type="submit" className="glass-button" style={{ padding: '16px', borderRadius: '12px', fontWeight: 800 }}>Send Enquiry →</button>
                            </form>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                <div style={{ fontSize: '40px', marginBottom: '16px' }}>✉️</div>
                                <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>Thank you</h3>
                                <p style={{ color: 'var(--text-secondary)' }}>Our events team will review your enquiry and respond within 24 hours.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Section 5: Footer */}
            <footer style={{ padding: '64px 80px', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/swiftlink-icon.png" alt="S" style={{ height: '24px' }} />
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>wiftlink</span>
                </div>
                <div style={{ display: 'flex', gap: '40px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <a href="#how" style={{ color: 'inherit', textDecoration: 'none' }}>Process</a>
                    <a href="#privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Security</a>
                    <a href="#corporate" style={{ color: 'inherit', textDecoration: 'none' }}>Enquiries</a>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    © 2026 Swiftlink. Privacy-first fleet operations.
                </div>
            </footer>
        </div>
    );
}
