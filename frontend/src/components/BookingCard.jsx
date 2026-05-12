import { useState } from 'react';

export default function BookingCard({ booking, drivers, vehicles, onAssign, index = 0 }) {
    const [selectedDriver, setSelectedDriver] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [eta, setEta] = useState('');
    const [assigning, setAssigning] = useState(false);

    const isPending = booking.status === 'pending';
    const statusColor = isPending ? 'rgba(255,180,0,0.15)' : 'rgba(0,245,160,0.15)';
    const statusText = isPending ? '#B8860B' : '#00A86B';

    const handleAssign = async () => {
        if (selectedDriver && selectedVehicle) {
            setAssigning(true);
            try {
                await onAssign(booking.id, selectedDriver, selectedVehicle, eta || null);
            } finally {
                setAssigning(false);
            }
        }
    };

    return (
        <div className="glass-card animate-fade-in-up" style={{ padding: '24px', animationDelay: `${index * 0.1}s`, overflow: 'visible' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>
                    {booking.client_first_name}
                </h3>
                <span style={{
                    background: statusColor, color: statusText,
                    padding: '4px 10px', borderRadius: '50px',
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                    margin: '12px 12px 0 0', position: 'relative'
                }}>
                    {booking.status}
                </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>
                    {booking.pickup_location} <span style={{ color: 'var(--text-muted)' }}>→</span> {booking.destination}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {booking.pickup_time ? new Date(booking.pickup_time).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' }) + ' EAT' : 'Invalid Date'}
                </p>
            </div>

            {booking.flight_number && (
                <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    ✈️ {booking.flight_number}
                </div>
            )}

            {booking.special_requirements && (
                <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    {booking.special_requirements}
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    style={{
                        flex: 1, background: 'var(--bg-input)', borderRadius: '10px',
                        border: '1px solid rgba(0,0,0,0.08)', padding: '10px 12px',
                        fontSize: '14px', color: 'var(--text-dark)', outline: 'none'
                    }}
                >
                    <option value="">Select Driver</option>
                    {drivers.map(d => (
                        <option key={d.driver_id} value={d.driver_id}>{d.full_name}</option>
                    ))}
                </select>

                <select
                    value={selectedVehicle}
                    onChange={(e) => setSelectedVehicle(e.target.value)}
                    style={{
                        flex: 1, background: 'var(--bg-input)', borderRadius: '10px',
                        border: '1px solid rgba(0,0,0,0.08)', padding: '10px 12px',
                        fontSize: '14px', color: 'var(--text-dark)', outline: 'none'
                    }}
                >
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => (
                        <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number} ({v.type})</option>
                    ))}
                </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)', marginBottom: '5px' }}>
                    Driver ETA <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <input
                    type="datetime-local"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)', padding: '10px 12px', fontSize: '13px', color: 'var(--text-dark)', outline: 'none', boxSizing: 'border-box' }}
                />
            </div>

            <button
                className="glass-button"
                onClick={handleAssign}
                disabled={!selectedDriver || !selectedVehicle || assigning}
                style={{
                    width: '100%', padding: '12px', borderRadius: '12px',
                    color: '#F5EDE3', fontSize: '14px', fontWeight: 600,
                    cursor: (!selectedDriver || !selectedVehicle || assigning) ? 'not-allowed' : 'pointer',
                    opacity: (!selectedDriver || !selectedVehicle || assigning) ? 0.6 : 1,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                }}
            >
                {assigning ? 'Assigning...' : 'Assign Trip →'}
            </button>
        </div>
    );
}
