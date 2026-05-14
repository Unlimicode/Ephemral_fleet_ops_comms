import { useState } from 'react';
import useFlightInfo from '../hooks/useFlightInfo.js';

const FLIGHT_STATUS = {
    scheduled: { label: 'Scheduled', color: '#6C63FF', bg: 'rgba(108,99,255,0.12)' },
    active:    { label: 'Airborne',  color: '#00D4FF', bg: 'rgba(0,212,255,0.12)' },
    landed:    { label: 'Landed',    color: '#00A86B', bg: 'rgba(0,245,160,0.12)' },
    cancelled: { label: 'Cancelled', color: '#E05A5A', bg: 'rgba(224,90,90,0.1)' },
    diverted:  { label: 'Diverted',  color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
};

function formatEAT(isoStr) {
    if (!isoStr) return null;
    return new Date(isoStr).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hour12: false }) + ' EAT';
}

function formatEATDate(isoStr) {
    if (!isoStr) return null;
    return new Date(isoStr).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' EAT';
}

export default function BookingCard({ booking, drivers, vehicles, onAssign, index = 0 }) {
    const [selectedDriver, setSelectedDriver] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [eta, setEta] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [showFlight, setShowFlight] = useState(false);

    const flightDate = booking.pickup_time ? new Date(booking.pickup_time).toISOString().split('T')[0] : null;
    const { data: flightInfo, loading: flightLoading, error: flightError, load: loadFlight } = useFlightInfo(
        booking.flight_number || null,
        flightDate,
        false
    );

    const handleFlightReveal = () => {
        setShowFlight(true);
        if (!flightInfo && !flightLoading) loadFlight();
    };

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

            {booking.flight_number && (() => {
                const fStatus = FLIGHT_STATUS[flightInfo?.flight_status] || null;
                const arrivalTime = flightInfo?.arrival?.actual || flightInfo?.arrival?.estimated || flightInfo?.arrival?.scheduled;
                return (
                    <div style={{ marginBottom: '12px' }}>
                        {/* Flight badge row — click to load */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(13,13,13,0.04)', padding: '8px 12px', borderRadius: showFlight && (flightInfo || flightLoading || flightError) ? '10px 10px 0 0' : '10px', cursor: showFlight ? 'default' : 'pointer' }}
                            onClick={!showFlight ? handleFlightReveal : undefined}>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--text-dark)', fontWeight: 600 }}>✈ {booking.flight_number}</span>
                            {!showFlight && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#6C63FF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Check →</span>
                            )}
                            {showFlight && flightLoading && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loading…</span>
                            )}
                            {showFlight && !flightLoading && fStatus && (
                                <span style={{ background: fStatus.bg, color: fStatus.color, padding: '3px 8px', borderRadius: '50px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{fStatus.label}</span>
                            )}
                        </div>
                        {/* Details panel */}
                        {showFlight && flightInfo?.found && (() => {
                            const depTime = flightInfo.departure?.actual || flightInfo.departure?.estimated || flightInfo.departure?.scheduled;
                            return (
                            <div style={{ background: 'rgba(13,13,13,0.03)', borderTop: '1px solid rgba(13,13,13,0.06)', padding: '10px 12px', borderRadius: '0 0 10px 10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>From</span>
                                    <span style={{ color: 'var(--text-dark)' }}>{flightInfo.departure.airport || flightInfo.departure.iata || '—'}</span>
                                </div>
                                {depTime && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                                            {flightInfo.departure.actual ? 'Departed' : flightInfo.departure.estimated ? 'Est. Dep.' : 'Sched. Dep.'}
                                        </span>
                                        <span style={{ color: 'var(--text-dark)', fontWeight: 700, fontFamily: 'monospace' }}>{formatEATDate(depTime)}</span>
                                    </div>
                                )}
                                <div style={{ borderTop: '1px solid rgba(13,13,13,0.06)', margin: '1px 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>To</span>
                                    <span style={{ color: 'var(--text-dark)' }}>{flightInfo.arrival.airport || flightInfo.arrival.iata || '—'}</span>
                                </div>
                                {arrivalTime && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                                            {flightInfo.arrival.actual ? 'Landed' : flightInfo.arrival.estimated ? 'Est. Arrival' : 'Sched. Arrival'}
                                        </span>
                                        <span style={{ color: flightInfo.arrival.delay > 0 ? '#F59E0B' : 'var(--text-dark)', fontWeight: 700, fontFamily: 'monospace' }}>{formatEATDate(arrivalTime)}</span>
                                    </div>
                                )}
                                {flightInfo.arrival.delay > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ color: '#F59E0B', fontWeight: 700 }}>⚠ Delay</span>
                                        <span style={{ color: '#F59E0B', fontWeight: 700 }}>+{flightInfo.arrival.delay} min</span>
                                    </div>
                                )}
                                {(flightInfo.arrival.terminal || flightInfo.arrival.gate) && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Terminal / Gate</span>
                                        <span style={{ color: 'var(--text-dark)' }}>
                                            {[flightInfo.arrival.terminal && `T${flightInfo.arrival.terminal}`, flightInfo.arrival.gate && `G${flightInfo.arrival.gate}`].filter(Boolean).join(' · ')}
                                        </span>
                                    </div>
                                )}
                                <button onClick={() => { loadFlight(); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, cursor: 'pointer', textAlign: 'right', padding: 0, alignSelf: 'flex-end' }}>
                                    ↻ Refresh
                                </button>
                            </div>
                            );
                        })()}
                        {showFlight && flightInfo && !flightInfo.found && !flightLoading && (
                            <div style={{ background: 'rgba(13,13,13,0.03)', borderTop: '1px solid rgba(13,13,13,0.06)', padding: '8px 12px', borderRadius: '0 0 10px 10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                No flight data found for this date.
                            </div>
                        )}
                        {showFlight && flightError && !flightInfo && (
                            <div style={{ background: 'rgba(224,90,90,0.06)', borderTop: '1px solid rgba(224,90,90,0.12)', padding: '8px 12px', borderRadius: '0 0 10px 10px', fontSize: '11px', color: '#E05A5A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{flightError}</span>
                                <button onClick={loadFlight} style={{ background: 'none', border: 'none', color: '#E05A5A', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Retry</button>
                            </div>
                        )}
                    </div>
                );
            })()}

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
