import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios.js';
import { useToast } from '../../components/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import ChatWindow from '../../components/ChatWindow.jsx';

export default function DriverActiveTripPage() {
    const { tripId } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { token } = useAuth();
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchTrip = useCallback(async () => {
        try {
            const res = await api.get(`/driver/trips/${tripId}`);
            setTrip(res.data);
        } catch (err) {
            console.error('Failed to load active trip', err);
            addToast('Failed to load trip details.', 'error');
            navigate('/driver/trips');
        } finally {
            setLoading(false);
        }
    }, [tripId, navigate, addToast]);

    useEffect(() => {
        fetchTrip();
    }, [fetchTrip]);

    const handleStartTrip = async () => {
        try {
            await api.patch(`/driver/trips/${tripId}/start`);
            addToast('Trip started successfully.', 'success');
            fetchTrip();
        } catch {
            addToast('Failed to start trip.', 'error');
        }
    };

    const handleCompleteTrip = async () => {
        try {
            await api.patch(`/driver/trips/${tripId}/complete`);
            addToast('Trip completed successfully.', 'success');
            navigate('/driver/trips');
        } catch {
            addToast('Failed to complete trip.', 'error');
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
    if (!trip) return <div style={{ padding: '40px', textAlign: 'center' }}>Trip not found.</div>;

    const isInProgress = trip.status === 'in_progress';

    return (
        <div style={{ padding: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header with back button */}
            <div className="reveal-up" style={{ padding: '20px 20px 0 20px' }}>
                <button onClick={() => navigate('/driver/trips')} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                    fontSize: '28px', cursor: 'pointer', alignSelf: 'flex-start', padding: 0
                }}>
                    ←
                </button>
            </div>

            {/* Section 1: Trip Status Card */}
            <section className={`glass-card reveal-up stagger-1 ${isInProgress ? 'session-pulse' : ''}`} style={{
                margin: '0 20px', padding: '24px', borderRadius: '24px',
                border: isInProgress ? '1px solid rgba(0,245,160,0.4)' : 'var(--glass-border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    {isInProgress && (
                        <span className="session-pulse" style={{
                            width: '12px', height: '12px', borderRadius: '50%',
                            background: 'var(--accent-success)', display: 'inline-block'
                        }} />
                    )}
                    <span style={{ fontSize: '12px', fontWeight: 700, color: isInProgress ? 'var(--accent-success)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {isInProgress ? 'Live Action' : 'Pending Start'}
                    </span>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Passenger</div>
                    <h2 className="kinetic-text" style={{ fontSize: '32px', margin: 0 }}>
                        {trip.client_first_name}
                    </h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.4)', padding: '16px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '15px', color: 'var(--text-dark)', fontWeight: 500 }}>
                        <span style={{ color: 'var(--text-muted)', marginRight: '10px' }}>↑</span>
                        {trip.pickup_location}
                    </div>
                    <div style={{ borderLeft: '2px dashed rgba(13,13,13,0.1)', height: '20px', marginLeft: '6px' }} />
                    <div style={{ fontSize: '15px', color: 'var(--text-dark)', fontWeight: 500 }}>
                        <span style={{ color: 'var(--text-muted)', marginRight: '10px' }}>↓</span>
                        {trip.destination}
                    </div>
                </div>

                {trip.flight_number && (
                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(13,13,13,0.04)', padding: '12px 16px', borderRadius: '12px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-dark)', fontWeight: 600 }}>🛬 {trip.flight_number}</span>
                        <span style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF', padding: '4px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: 700 }}>TRACKING</span>
                    </div>
                )}
            </section>

            {/* Section 2: Action Buttons */}
            <section className="reveal-up stagger-2" style={{ padding: '0 20px' }}>
                {trip.status === 'assigned' && (
                    <button className="btn-premium" onClick={handleStartTrip} style={{
                        width: '100%', padding: '18px', fontSize: '16px'
                    }}>
                        Start Trip — Client Picked Up ✓
                    </button>
                )}
                {trip.status === 'in_progress' && (
                    <button className="btn-premium" onClick={handleCompleteTrip} style={{
                        width: '100%', padding: '18px', fontSize: '16px', background: '#D32F2F', color: 'white'
                    }}>
                        Complete Trip — Dropped Off ✓
                    </button>
                )}
            </section>

            {/* Section 3: Communication Panel */}
            <section className="glass-card-dark reveal-up stagger-3" style={{
                margin: '0 20px',
                padding: '24px',
                borderRadius: '24px',
                flex: 1,
                minHeight: '450px',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F5EDE3', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🔒 Secure Channel
                    </h3>
                    {isInProgress && (
                        <span className="session-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-success)' }} />
                    )}
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(245,237,227,0.6)', marginBottom: '16px', lineHeight: 1.5 }}>
                    End-to-end mediated communication — no contact details exchanged.
                </p>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <ChatWindow
                        tripId={tripId}
                        token={token}
                        role="driver"
                        counterpartName={trip.client_first_name || 'Passenger'}
                    />
                </div>
            </section>

            {/* Section 4: Trip Details */}
            <section className="glass-card reveal-up stagger-4" style={{ margin: '0 20px', padding: '24px', borderRadius: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 16px 0' }}>Manifest Details</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Reference</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-dark)' }}>{trip.id || 'N/A'}</div>
                    </div>

                    {trip.special_requirements && (
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Special Requirements</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-dark)' }}>{trip.special_requirements}</div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
