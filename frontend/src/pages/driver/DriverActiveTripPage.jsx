import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios.js';
import { useToast } from '../../components/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import ChatWindow from '../../components/ChatWindow.jsx';

export default function DriverActiveTripPage() {
    const { tripId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { token } = useAuth();
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchTrip = useCallback(async () => {
        try {
            const res = await api.get(`/driver/trips/${tripId}`);
            setTrip(res.data);
        } catch (err) {
            console.error('Failed to load active trip', err);
            showToast('Failed to load trip details.', 'error');
            navigate('/driver/trips');
        } finally {
            setLoading(false);
        }
    }, [tripId, navigate, showToast]);

    useEffect(() => {
        fetchTrip();
    }, [fetchTrip]);

    const handleStartTrip = async () => {
        try {
            await api.patch(`/driver/trips/${tripId}/start`);
            showToast('Trip started successfully.', 'success');
            fetchTrip();
        } catch {
            showToast('Failed to start trip.', 'error');
        }
    };

    const handleCompleteTrip = async () => {
        try {
            await api.patch(`/driver/trips/${tripId}/complete`);
            showToast('Trip completed successfully.', 'success');
            navigate('/driver/trips');
        } catch {
            showToast('Failed to complete trip.', 'error');
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
    if (!trip) return <div style={{ padding: '40px', textAlign: 'center' }}>Trip not found.</div>;

    const isInProgress = trip.status === 'in_progress';

    return (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header with back button */}
            <button onClick={() => navigate('/driver/trips')} style={{
                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                fontSize: '28px', cursor: 'pointer', alignSelf: 'flex-start', padding: '0 10px 0 0'
            }}>
                ←
            </button>

            {/* Section 1: Trip Status Card */}
            <section className={`glass-card ${isInProgress ? 'session-pulse' : ''}`} style={{
                padding: '24px', borderRadius: '24px',
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
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-dark)', margin: 0, fontFamily: 'Inter, sans-serif' }}>
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
            <section>
                {trip.status === 'assigned' && (
                    <button className="glass-button" onClick={handleStartTrip} style={{
                        width: '100%', padding: '18px', borderRadius: '20px',
                        color: '#F5EDE3', fontSize: '16px', fontWeight: 700,
                        boxShadow: '0 8px 32px rgba(180,130,80,0.2)'
                    }}>
                        Start Trip — Client Picked Up ✓
                    </button>
                )}
                {trip.status === 'in_progress' && (
                    <button className="glass-button" onClick={handleCompleteTrip} style={{
                        width: '100%', padding: '18px', borderRadius: '20px',
                        background: 'var(--text-dark)', color: '#F5EDE3', fontSize: '16px', fontWeight: 700,
                        boxShadow: '0 8px 32px rgba(13,13,13,0.2)'
                    }}>
                        Complete Trip — Dropped Off ✓
                    </button>
                )}
            </section>

            {/* Section 3: Communication Panel */}
            <section className="glass-card" style={{
                padding: '24px',
                borderRadius: '24px',
                flex: 1,
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-dark)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🔒 Secure Channel
                    </h3>
                    {isInProgress && (
                        <span className="session-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-success)' }} />
                    )}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                    End-to-end mediated communication — no contact details exchanged.
                </p>
                <div style={{ flex: 1 }}>
                    <ChatWindow
                        tripId={tripId}
                        token={token}
                        role="driver"
                        counterpartName={trip.client_first_name || 'Passenger'}
                    />
                </div>
            </section>

            {/* Section 4: Trip Details */}
            <section className="glass-card" style={{ padding: '24px', borderRadius: '24px' }}>
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
