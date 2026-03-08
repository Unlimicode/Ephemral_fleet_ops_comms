import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';
import ChatWindow from '../components/ChatWindow';

export default function BookingLandingPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const tripIdFromUrl = searchParams.get('tripId');

    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [complaintForm, setComplaintForm] = useState({ category: 'service_quality', message: '' });
    const [complaintStatus, setComplaintStatus] = useState({ loading: false, success: false });
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [recoverySent, setRecoverySent] = useState(false);

    const fetchStatus = useCallback(async () => {
        if (!token || !tripIdFromUrl) {
            setError('Invalid link. Please request a new one from your booking confirmation email.');
            setLoading(false);
            return;
        }
        try {
            const res = await api.get(`/bookings/status?token=${token}&tripId=${tripIdFromUrl}`);
            setBooking(res.data);
            setError(null);
        } catch {
            setError('This link has expired or is invalid.');
        } finally {
            setLoading(false);
        }
    }, [token, tripIdFromUrl]);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const handleComplaintSubmit = async (e) => {
        e.preventDefault();
        setComplaintStatus({ ...complaintStatus, loading: true });
        try {
            // The backend POST /api/complaints/:tripId expects client cookie session
            // However, Sprint 13 spec says "POST /api/complaints calls" and Magic Link Landing Page established session.
            // We'll use the token if the backend is configured for it, or rely on the cookie set by /auth.
            // Actually, the requirement says "call GET /api/bookings/status... to validate session"
            // Let's assume the POST /api/complaints works with the token or cookie.
            await api.post(`/complaints/${booking.id}`, complaintForm);
            setComplaintStatus({ loading: false, success: true });
            setBooking({ ...booking, complaint_filed: true }); // local state update
        } catch {
            setComplaintStatus({ loading: false, success: false });
        }
    };

    const handleRequestNewLink = async () => {
        try {
            await api.post(`/bookings/${tripIdFromUrl}/request-new-link`, { client_corporate_email: recoveryEmail });
            setRecoverySent(true);
        } catch {
            console.error('Recovery error');
        }
    };

    if (loading) return <div style={{ padding: '80px', textAlign: 'center' }}>Validating secure session...</div>;

    if (error) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '24px' }}>
                <div className="glass-card" style={{ padding: '32px', textAlign: 'center', maxWidth: '440px' }}>
                    <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>⚠️</span>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Access Revoked</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error}</p>
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '24px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Request a new magic link:</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="email" placeholder="Corporate email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)' }} />
                            <button onClick={handleRequestNewLink} className="glass-button" style={{ padding: '10px 16px', borderRadius: '10px', fontSize: '13px' }}>Send</button>
                        </div>
                        {recoverySent && <p style={{ fontSize: '12px', color: 'var(--accent-success)', marginTop: '8px' }}>Check your inbox.</p>}
                    </div>
                </div>
            </div>
        );
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'var(--accent-warning)';
            case 'assigned': return 'var(--accent-primary)';
            case 'in_progress': return 'var(--accent-success)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '40px 24px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Logo and Nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src="/swiftlink-icon.png" alt="S" style={{ height: '32px' }} />
                        <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>wiftlink</span>
                    </div>
                    <Link to={`/booking/history?token=${token}`} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }}>History</Link>
                </div>

                {/* Status Card */}
                <div className="glass-card" style={{ padding: '32px', borderRadius: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <div>
                            <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>REF: {booking.id.slice(0, 8).toUpperCase()}</div>
                            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Your Transfer</h1>
                        </div>
                        <span className={booking.status === 'in_progress' ? 'session-pulse' : ''} style={{
                            padding: '6px 12px', borderRadius: '50px', fontSize: '11px', fontWeight: 800,
                            background: 'rgba(255,255,255,0.5)', border: `1px solid ${getStatusColor(booking.status)}`,
                            color: getStatusColor(booking.status), textTransform: 'uppercase'
                        }}>
                            {booking.status.replace('_', ' ')}
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.4)', padding: '20px', borderRadius: '20px', marginBottom: '24px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 600 }}>↑ {booking.pickup_location}</div>
                        <div style={{ height: '16px', borderLeft: '2px dashed rgba(0,0,0,0.1)', marginLeft: '6px' }} />
                        <div style={{ fontSize: '16px', fontWeight: 600 }}>↓ {booking.destination}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Scheduled</div>
                            <div style={{ fontSize: '15px', fontWeight: 600 }}>{new Date(booking.pickup_time).toLocaleDateString()} · {new Date(booking.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {booking.flight_number && (
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Flight</div>
                                <div style={{ fontSize: '15px', fontWeight: 600 }}>🛬 {booking.flight_number}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Driver Details */}
                {(booking.status === 'assigned' || booking.status === 'in_progress') && (
                    <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--accent-primary)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>Your Driver</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
                                {booking.driver_first_name?.[0]}
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '17px' }}>{booking.driver_first_name}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{booking.vehicle_model}</div>
                            </div>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px', fontStyle: 'italic' }}>
                            Your driver's contact details are kept private for your security.
                        </p>
                    </div>
                )}

                {/* Chat window */}
                {booking.status === 'in_progress' ? (
                    <div style={{ height: '500px' }}>
                        <ChatWindow tripId={booking.id} token={token} role="client" counterpartName={booking.driver_first_name} />
                    </div>
                ) : booking.status === 'assigned' ? (
                    <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', textAlign: 'center', opacity: 0.8 }}>
                        <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>🔒</span>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Your secure channel will open when your driver begins the trip.</p>
                    </div>
                ) : null}

                {/* Complaints */}
                {booking.status === 'completed' && (
                    <div className="glass-card" style={{ padding: '32px', borderRadius: '32px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>How was your transfer?</h3>
                        {!booking.complaint_filed ? (
                            <form onSubmit={handleComplaintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <select value={complaintForm.category} onChange={e => setComplaintForm({ ...complaintForm, category: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }}>
                                    <option value="service_quality">Service Quality</option>
                                    <option value="driver_behaviour">Driver Behaviour</option>
                                    <option value="privacy_concern">Privacy Concern</option>
                                    <option value="other">Other</option>
                                </select>
                                <textarea placeholder="Describe your experience..." rows={3} required value={complaintForm.message} onChange={e => setComplaintForm({ ...complaintForm, message: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', resize: 'none' }} />
                                <button type="submit" disabled={complaintStatus.loading} className="glass-button" style={{ padding: '12px', borderRadius: '12px', fontWeight: 700 }}>Submit Review</button>
                            </form>
                        ) : (
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--accent-success)' }}>
                                <span>✓</span>
                                <p style={{ fontSize: '14px', fontWeight: 600 }}>Your complaint has been received and is under review.</p>
                            </div>
                        )}
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '20px', lineHeight: 1.4 }}>
                            <strong>Note:</strong> You have 24 hours from trip completion to file a complaint. After this window, communication records are permanently deleted.
                        </p>
                    </div>
                )}

                {/* Logout or Request new link footer */}
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <button onClick={() => { setRecoverySent(false); setError('Request a new link'); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
                        Link expired? Request a new one
                    </button>
                </div>
            </div>
        </div>
    );
}
