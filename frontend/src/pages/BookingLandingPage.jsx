import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import ChatWindow from '../components/ChatWindow';

const statusConfig = {
    pending: { label: 'Pending Assignment', color: 'var(--accent-warning)', bg: 'rgba(224,90,90,0.08)' },
    accepted: { label: 'Driver Assigned', color: 'var(--accent-primary)', bg: 'rgba(108,99,255,0.08)' },
    in_progress: { label: 'In Transit', color: 'var(--accent-success)', bg: 'rgba(0,245,160,0.08)' },
    completed: { label: 'Completed', color: 'var(--text-muted)', bg: 'rgba(0,0,0,0.04)' },
};

const StatusBadge = ({ status }) => {
    const cfg = statusConfig[status] || statusConfig.pending;
    return (
        <span style={{
            padding: '6px 14px', borderRadius: '9999px',
            fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
            color: cfg.color, background: cfg.bg,
            border: `1px solid ${cfg.color}`,
            whiteSpace: 'nowrap'
        }}>
            {cfg.label}
        </span>
    );
};

export default function BookingLandingPage() {
    const [searchParams] = useSearchParams();
    const [tripId, setTripId] = useState(null);
    const [clientName, setClientName] = useState('');
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authStage, setAuthStage] = useState('init'); // init | authed | error
    const [error, setError] = useState(null);
    const [complaintForm, setComplaintForm] = useState({ category: 'service_quality', description: '' });
    const [complaintStatus, setComplaintStatus] = useState({ loading: false, success: false, error: null });
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [recoverySent, setRecoverySent] = useState(false);
    const [complaintWindowSeconds, setComplaintWindowSeconds] = useState(null);

    useEffect(() => {
        const init = async () => {
            const token = searchParams.get('token');

            if (token) {
                // Fresh magic link visit — exchange token for cookie session
                try {
                    const res = await api.get(`/bookings/auth?token=${token}`);
                    setTripId(res.data.trip_id);
                    setClientName(res.data.client_first_name);
                    setAuthStage('authed');
                    // Clean token from URL without reload
                    window.history.replaceState({}, '', '/booking');
                } catch {
                    setError('This link has expired or has already been used. Request a new one below.');
                    setAuthStage('error');
                    setLoading(false);
                }
            } else {
                // Return visit — hydrate from cookie
                try {
                    const res = await api.get('/bookings/session');
                    setTripId(res.data.trip_id);
                    setClientName(res.data.client_first_name);
                    setAuthStage('authed');
                } catch {
                    setError('Your session has expired. Request a new link below.');
                    setAuthStage('error');
                    setLoading(false);
                }
            }
        };
        init();
    }, [searchParams]);

    const fetchTrip = useCallback(async () => {
        if (!tripId) return;
        try {
            const res = await api.get(`/bookings/${tripId}`);
            setBooking(res.data);
            // If completed, start 24hr countdown from now (approximation)
            if (res.data.status === 'completed' && complaintWindowSeconds === null) {
                setComplaintWindowSeconds(24 * 60 * 60); // 24hrs
            }
        } catch {
            setError('Unable to load booking details.');
        } finally {
            setLoading(false);
        }
    }, [tripId, complaintWindowSeconds]);

    useEffect(() => {
        if (tripId) {
            fetchTrip();
            const interval = setInterval(fetchTrip, 30000);
            return () => clearInterval(interval);
        }
    }, [fetchTrip, tripId]);

    const countdownStarted = useRef(false);

    useEffect(() => {
        if (complaintWindowSeconds === null || complaintWindowSeconds <= 0) return;
        if (countdownStarted.current) return;
        countdownStarted.current = true;
        const timer = setInterval(() => {
            setComplaintWindowSeconds(prev => {
                if (prev <= 1) { clearInterval(timer); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [complaintWindowSeconds]);

    const formatCountdown = (secs) => {
        const h = String(Math.floor(secs / 3600)).padStart(2, '0');
        const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
        const s = String(secs % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const handleComplaintSubmit = async (e) => {
        e.preventDefault();
        setComplaintStatus({ loading: true, success: false, error: null });
        try {
            await api.post(`/complaints/${tripId}`, complaintForm);
            setComplaintStatus({ loading: false, success: true, error: null });
            setBooking(prev => ({ ...prev, complaint_filed: true }));
        } catch {
            setComplaintStatus({ loading: false, success: false, error: 'Failed to submit. Please try again.' });
        }
    };

    const handleRequestNewLink = async () => {
        if (!recoveryEmail) return;
        try {
            await api.post(`/bookings/${tripId || 'unknown'}/request-new-link`, {
                client_corporate_email: recoveryEmail
            });
            setRecoverySent(true);
        } catch {
            setRecoverySent(true); // Opaque response — always show success
        }
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    border: '3px solid rgba(108,99,255,0.2)',
                    borderTop: '3px solid var(--accent-primary)',
                    animation: 'spinSlow 1s linear infinite',
                    margin: '0 auto 16px'
                }} />
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Validating secure session
                </p>
            </div>
        </div>
    );

    if (authStage === 'error') return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div className="arch-grid" style={{ position: 'fixed', inset: 0, opacity: 0.3, pointerEvents: 'none' }} />
            <div className="glass-card" style={{ padding: '48px 40px', textAlign: 'center', maxWidth: '440px', borderRadius: '2.5rem', position: 'relative', zIndex: 1 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(224,90,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 28 }}>{'\uD83D\uDD12'}</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>Access Required</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>{error}</p>
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 24 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.5, marginBottom: 12 }}>Request a new magic link</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            type="email" placeholder="Corporate email"
                            value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)}
                            style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.6)', fontSize: 14, outline: 'none' }}
                        />
                        <button onClick={handleRequestNewLink} className="btn-premium btn-dark" style={{ padding: '12px 20px', borderRadius: '12px', fontSize: 14 }}>Send</button>
                    </div>
                    {recoverySent && <p style={{ fontSize: 13, color: 'var(--accent-success)', marginTop: 12, fontWeight: 600 }}>✓ Check your inbox.</p>}
                </div>
            </div>
        </div>
    );

    if (!booking) return null;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-base)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background elements */}
            <div className="arch-grid" style={{ position: 'fixed', inset: 0, opacity: 0.4, pointerEvents: 'none', zIndex: 0 }} />
            <div className="geo-shape animate-float-slow" style={{ position: 'fixed', top: '10%', right: '-5%', color: 'rgba(108,99,255,0.08)', zIndex: 0 }}>
                <div className="geo-triangle" style={{ transform: 'scale(2.5) rotate(15deg)', width: '100px', height: '100px', background: 'currentColor', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
            </div>
            <div className="geo-shape animate-float-reverse" style={{ position: 'fixed', bottom: '5%', left: '-8%', color: 'rgba(13,13,13,0.06)', zIndex: 0 }}>
                <div className="geo-triangle" style={{ transform: 'scale(3) rotate(-10deg)', width: '100px', height: '100px', background: 'currentColor', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
            </div>

            <nav style={{
                padding: '20px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'relative', zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/swiftlink-icon.png" alt="Swiftlink" style={{ height: '32px', borderRadius: '7px' }} />
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Swiftlink</span>
                </div>
                {tripId && (
                    <a href={`/booking/history`} style={{
                        fontSize: '13px', fontWeight: 600,
                        color: 'var(--accent-primary)', textDecoration: 'none',
                        padding: '8px 16px', borderRadius: '9999px',
                        background: 'rgba(108,99,255,0.08)',
                        border: '1px solid rgba(108,99,255,0.15)'
                    }}>History</a>
                )}
            </nav>

            <div style={{
                maxWidth: '600px', width: '100%',
                margin: '0 auto', padding: '0 24px 80px',
                position: 'relative', zIndex: 1,
                display: 'flex', flexDirection: 'column', gap: '20px'
            }}>
                {/* Trip status card */}
                <div className="glass-card reveal-up active" style={{ padding: '32px', borderRadius: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                        <div>
                            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.1em' }}>
                                REF: {booking.id.slice(0, 8).toUpperCase()}
                            </div>
                            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>
                                {clientName ? `Hi, ${clientName}` : 'Your Transfer'}
                            </h1>
                        </div>
                        <StatusBadge status={booking.status} />
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.5)', padding: '20px 24px', borderRadius: '1.25rem', marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                            <span style={{ fontSize: 15, fontWeight: 600 }}>{booking.pickup_location}</span>
                        </div>
                        <div style={{ height: 20, borderLeft: '2px dashed rgba(0,0,0,0.12)', marginLeft: 3, marginBottom: 12 }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '4px', background: '#0D0D0D', flexShrink: 0 }} />
                            <span style={{ fontSize: 15, fontWeight: 600 }}>{booking.destination}</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: booking.flight_number ? '1fr 1fr' : '1fr', gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 4 }}>Scheduled</div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>
                                {new Date(booking.pickup_time).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })} · {new Date(booking.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        {booking.flight_number && (
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 4 }}>Flight</div>
                                <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span>{'\u2708\uFE0F'}</span> {booking.flight_number}
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>· Tracked</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pending message */}
                {booking.status === 'pending' && (
                    <div className="glass-card reveal-up active stagger-1" style={{ padding: '28px 32px', borderRadius: '1.5rem', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(224,90,90,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{'\u23F3'}</div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Awaiting driver assignment</h3>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                Our dispatch team is reviewing your request. You will receive an email notification once a driver is assigned.
                            </p>
                        </div>
                    </div>
                )}

                {/* Driver card */}
                {(booking.status === 'accepted' || booking.status === 'in_progress') && (
                    <div className="glass-card reveal-up active stagger-1" style={{
                        padding: '28px 32px', borderRadius: '1.5rem',
                        border: '1px solid rgba(108,99,255,0.2)'
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-primary)', marginBottom: 16 }}>Your Driver</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                            <div style={{
                                width: 52, height: 52, borderRadius: '50%',
                                background: 'var(--accent-primary)', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 22, fontWeight: 800, flexShrink: 0
                            }}>
                                {booking.driver_name?.[0] || '?'}
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 18 }}>{booking.driver_name?.split(' ')[0] || 'Your Driver'}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{booking.vehicle_type || 'Vehicle assigned'}</div>
                            </div>
                        </div>
                        <div style={{
                            padding: '10px 14px', borderRadius: '10px',
                            background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)',
                            display: 'flex', alignItems: 'center', gap: 8
                        }}>
                            <span style={{ fontSize: 14 }}>{'\uD83D\uDD12'}</span>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                Your driver's contact details are structurally excluded from this session.
                            </p>
                        </div>
                    </div>
                )}

                {/* Chat window */}
                {booking.status === 'in_progress' && (
                    <div style={{ height: '480px' }}>
                        <ChatWindow
                            tripId={tripId}
                            token={null}
                            role="client"
                            counterpartName={booking.driver_name?.split(' ')[0] || 'Driver'}
                        />
                    </div>
                )}

                {/* Chat locked */}
                {booking.status === 'accepted' && (
                    <div className="glass-card reveal-up active stagger-2" style={{ padding: '32px', borderRadius: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>{'\uD83D\uDD12'}</div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 8 }}>Secure channel standing by</p>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            Your encrypted communication channel will open automatically when your driver begins the trip.
                        </p>
                    </div>
                )}

                {/* Post-trip / complaint */}
                {booking.status === 'completed' && (
                    <div className="glass-card reveal-up active stagger-1" style={{ padding: '32px', borderRadius: '2rem' }}>
                        {complaintWindowSeconds !== null && complaintWindowSeconds > 0 && (
                            <div style={{
                                background: 'rgba(0,0,0,0.03)', borderRadius: '1rem',
                                padding: '16px 20px', marginBottom: 24,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 4 }}>Complaint window closes in</div>
                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: 'var(--accent-warning)' }}>
                                        {formatCountdown(complaintWindowSeconds)}
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180, textAlign: 'right', lineHeight: 1.4 }}>
                                    After this window, communication records are permanently deleted
                                </div>
                            </div>
                        )}

                        {complaintWindowSeconds === 0 && (
                            <div style={{ textAlign: 'center', padding: '16px 0', marginBottom: 24, color: 'var(--text-muted)', fontSize: 14 }}>
                                The complaint window has closed. All communication records have been permanently deleted.
                            </div>
                        )}

                        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>How was your transfer?</h3>

                        {!booking.complaint_filed && (complaintWindowSeconds === null || complaintWindowSeconds > 0) ? (
                            <form onSubmit={handleComplaintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'block', color: 'var(--text-muted)' }}>Category</label>
                                    <select
                                        value={complaintForm.category}
                                        onChange={e => setComplaintForm({ ...complaintForm, category: e.target.value })}
                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.6)', fontSize: 14, outline: 'none' }}
                                    >
                                        <option value="service_quality">Service Quality</option>
                                        <option value="driver_behaviour">Driver Behaviour</option>
                                        <option value="privacy_concern">Privacy Concern</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'block', color: 'var(--text-muted)' }}>Description</label>
                                    <textarea
                                        placeholder="Describe your experience..."
                                        rows={4} required
                                        value={complaintForm.description}
                                        onChange={e => setComplaintForm({ ...complaintForm, description: e.target.value })}
                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.6)', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                                {complaintStatus.error && (
                                    <p style={{ fontSize: 13, color: 'var(--accent-warning)', padding: '10px 14px', background: 'rgba(224,90,90,0.06)', borderRadius: '10px' }}>
                                        {complaintStatus.error}
                                    </p>
                                )}
                                <button type="submit" disabled={complaintStatus.loading} className="btn-premium btn-dark" style={{ padding: '14px', borderRadius: '12px', fontSize: 15, letterSpacing: '0.05em' }}>
                                    {complaintStatus.loading ? 'Submitting...' : 'Submit Complaint'}
                                </button>
                            </form>
                        ) : booking.complaint_filed || complaintStatus.success ? (
                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '20px', background: 'rgba(0,245,160,0.06)', borderRadius: '1rem', border: '1px solid rgba(0,245,160,0.2)' }}>
                                <span style={{ color: 'var(--accent-success)', fontSize: 20 }}>{'\u2713'}</span>
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-dark)', marginBottom: 4 }}>Complaint received</p>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Your complaint is under review. Communication records for this trip have been preserved pending investigation.</p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Footer recovery */}
                <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                    {!recoverySent ? (
                        <div>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Link expired or need to return later?</p>
                            <div style={{ display: 'flex', gap: 8, maxWidth: 360, margin: '0 auto' }}>
                                <input
                                    type="email" placeholder="Corporate email"
                                    value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)}
                                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', fontSize: 13, outline: 'none' }}
                                />
                                <button onClick={handleRequestNewLink} className="btn-premium btn-dark" style={{ padding: '10px 16px', borderRadius: '10px', fontSize: 13 }}>
                                    New Link
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p style={{ fontSize: 13, color: 'var(--accent-success)', fontWeight: 600 }}>{'\u2713'} New link sent. Check your inbox.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
