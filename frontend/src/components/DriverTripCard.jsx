import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DriverTripCard({ trip, index, onAccept, onDecline }) {
    const navigate = useNavigate();
    const [isDeclining, setIsDeclining] = useState(false);
    const [declineReason, setDeclineReason] = useState('');

    const statusMap = {
        accepted: { bg: 'rgba(255,180,0,0.15)', text: '#B8860B', label: 'Assigned', pulse: false },
        assigned: { bg: 'rgba(255,180,0,0.15)', text: '#B8860B', label: 'Assigned', pulse: false },
        in_progress: { bg: 'rgba(0,245,160,0.15)', text: '#00A86B', label: 'In Progress', pulse: true },
        completed: { bg: 'rgba(13,13,13,0.08)', text: 'var(--text-muted)', label: 'Completed', pulse: false }
    };

    const currentStatus = statusMap[trip.status] || statusMap['assigned'];

    const handleDeclineSubmit = () => {
        if (!declineReason.trim()) {
            alert('A reason is required to decline.');
            return;
        }
        onDecline(trip.id, declineReason);
        setIsDeclining(false);
    };

    return (
        <div className="glass-card reveal-up" style={{
            padding: '16px',
            borderRadius: '20px',
            marginBottom: '12px',
            animationDelay: `${index * 0.1}s`,
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Top row: Status and Time */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 8px 0 0', position: 'relative' }}>
                    {currentStatus.pulse && (
                        <span className="session-pulse" style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: currentStatus.text, display: 'inline-block'
                        }} />
                    )}
                    <span style={{
                        background: currentStatus.bg, color: currentStatus.text,
                        padding: '4px 10px', borderRadius: '50px',
                        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase'
                    }}>
                        {currentStatus.label}
                    </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {trip.pickup_time ? new Date(trip.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                </span>
            </div>

            {/* Client and Route */}
            <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>
                    {trip.client_first_name || 'Passenger'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.4)', padding: '12px', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>↑</span>
                        <span style={{ wordBreak: 'break-word' }}>{trip.pickup_location}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>↓</span>
                        <span style={{ wordBreak: 'break-word' }}>{trip.destination}</span>
                    </div>
                </div>
            </div>

            {/* Vehicle & Flight info */}
            <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {trip.registration_number && (
                    <div style={{ background: 'rgba(13,13,13,0.05)', padding: '4px 10px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>VEHICLE: </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-dark)', fontWeight: 600 }}>{trip.registration_number} ({trip.type || 'Standard'})</span>
                    </div>
                )}
                {trip.flight_number && (
                    <div style={{ background: 'rgba(13,13,13,0.05)', padding: '4px 10px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>FLIGHT: </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-dark)', fontWeight: 600 }}>{trip.flight_number}</span>
                    </div>
                )}
            </div>

            {/* Actions based on status */}
            {trip.status === 'accepted' && !isDeclining && (
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setIsDeclining(true)} style={{
                        flex: 1, padding: '12px', borderRadius: '12px',
                        background: 'transparent', border: '1px solid rgba(13,13,13,0.3)',
                        color: 'var(--text-dark)', fontSize: '14px', fontWeight: 600,
                        cursor: 'pointer'
                    }}>
                        Decline ✗
                    </button>
                    <button className="glass-button" onClick={() => onAccept(trip.id)} style={{
                        flex: 2, padding: '12px', borderRadius: '12px',
                        color: '#F5EDE3', fontSize: '14px', fontWeight: 600,
                        cursor: 'pointer'
                    }}>
                        Accept ✓
                    </button>
                </div>
            )}

            {isDeclining && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                        type="text"
                        placeholder="Reason for declining"
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        style={{
                            width: '100%', padding: '12px', borderRadius: '12px',
                            border: '1px solid rgba(13,13,13,0.2)', background: 'var(--bg-input)',
                            color: 'var(--text-dark)', fontSize: '14px', fontFamily: 'Inter, sans-serif',
                            boxSizing: 'border-box'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => setIsDeclining(false)} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleDeclineSubmit} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', color: '#D32F2F', fontWeight: 600, cursor: 'pointer' }}>Confirm Decline</button>
                    </div>
                </div>
            )}

            {trip.status === 'in_progress' && (
                <button className="glass-button" onClick={() => navigate(`/driver/trips/${trip.id}`)} style={{
                    width: '100%', padding: '12px', borderRadius: '12px',
                    color: '#F5EDE3', fontSize: '14px', fontWeight: 600,
                    cursor: 'pointer'
                }}>
                    View Active Trip →
                </button>
            )}
        </div>
    );
}