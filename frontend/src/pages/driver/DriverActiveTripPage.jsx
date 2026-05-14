import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios.js';
import { useToast } from '../../components/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import ChatWindow from '../../components/ChatWindow.jsx';
import useFlightInfo from '../../hooks/useFlightInfo.js';

const FLIGHT_STATUS = {
    scheduled: { label: 'Scheduled', color: '#6C63FF', bg: 'rgba(108,99,255,0.15)' },
    active:    { label: 'Airborne',  color: '#00D4FF', bg: 'rgba(0,212,255,0.15)' },
    landed:    { label: 'Landed',    color: '#00A86B', bg: 'rgba(0,245,160,0.15)' },
    cancelled: { label: 'Cancelled', color: '#E05A5A', bg: 'rgba(224,90,90,0.1)' },
    diverted:  { label: 'Diverted',  color: '#F59E0B', bg: 'rgba(245,158,11,0.2)' },
};

function formatEAT(isoStr) {
    if (!isoStr) return null;
    return new Date(isoStr).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hour12: false }) + ' EAT';
}

function formatEATDate(isoStr) {
    if (!isoStr) return null;
    return new Date(isoStr).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' EAT';
}

export default function DriverActiveTripPage() {
    const { tripId } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { token } = useAuth();
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [complaint, setComplaint] = useState(null);
    const [dms, setDms] = useState([]);
    const [dmInput, setDmInput] = useState('');
    const [sendingDm, setSendingDm] = useState(false);

    const flightDate = trip?.pickup_time ? new Date(trip.pickup_time).toISOString().split('T')[0] : null;
    const { data: flightInfo, loading: flightLoading, error: flightError, load: loadFlight } = useFlightInfo(
        trip?.flight_number || null,
        flightDate,
        !!trip?.flight_number
    );

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

    const fetchComplaint = useCallback(async () => {
        try {
            const res = await api.get(`/driver/trips/${tripId}/complaint`);
            setComplaint(res.data.complaint);
        } catch {
            // complaint may not exist yet — silent fail is correct
        }
    }, [tripId]);

    const fetchDms = useCallback(async () => {
        try {
            const res = await api.get(`/driver/trips/${tripId}/direct-messages`);
            setDms(res.data);
        } catch {
            // silent — DM table may not be migrated yet in all envs
        }
    }, [tripId]);

    useEffect(() => {
        fetchTrip();
        fetchComplaint();
        fetchDms();
        api.patch(`/drivers/notifications/read-by-trip/${tripId}`).catch(() => {});
        const interval = setInterval(() => { fetchTrip(); fetchComplaint(); fetchDms(); }, 10000);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchTrip();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchTrip, fetchComplaint, fetchDms, tripId]);

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

    const handleSendDm = async () => {
        if (!dmInput.trim() || sendingDm) return;
        setSendingDm(true);
        try {
            await api.post(`/driver/trips/${tripId}/direct-message`, { body: dmInput.trim() });
            setDmInput('');
            await fetchDms();
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to send message.';
            addToast(msg, 'error');
        } finally {
            setSendingDm(false);
        }
    };

    if (!loading && !trip) return (
        <div style={{ padding: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="reveal-up" style={{ padding: '20px 20px 0 20px' }}>
                <button onClick={() => navigate('/driver/trips')} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                    fontSize: '28px', cursor: 'pointer', padding: 0
                }}>←</button>
            </div>
            <div style={{ padding: '0 20px' }}>
                <div className="glass-card-dark" style={{ padding: '40px 24px', borderRadius: '24px', textAlign: 'center' }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '999px',
                        background: 'rgba(108,99,255,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', fontSize: '40px', color: '#6C63FF'
                    }}>⚠️</div>
                    <p className="kinetic-text" style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.05em', color: '#FFF', margin: '0 0 6px 0' }}>Trip Not Found</p>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, margin: '0 0 24px 0' }}>This trip may have ended or is unavailable.</p>
                    <button className="btn-premium" onClick={() => navigate('/driver/trips')} style={{ background: '#6C63FF', padding: '14px 32px' }}>
                        Back to Trips
                    </button>
                </div>
            </div>
        </div>
    );

    const isInProgress = trip?.status === 'in_progress';
    const isCancelled = trip?.status === 'cancelled';
    const sh = { background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite linear', borderRadius: '12px' };

    return (
        <div style={{ padding: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <style>{`@keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }`}</style>

            {/* Header with back button — always visible */}
            <div className="reveal-up" style={{ padding: '20px 20px 0 20px' }}>
                <button onClick={() => navigate('/driver/trips')} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                    fontSize: '28px', cursor: 'pointer', alignSelf: 'flex-start', padding: 0
                }}>
                    ←
                </button>
            </div>

            {loading ? (
                <>
                    {/* Section 1 skeleton */}

                    <section className="glass-card" style={{ margin: '0 20px', padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ ...sh, width: '200px', height: '32px' }} />
                        <div style={{ ...sh, width: '100%', height: '18px' }} />
                        <div style={{ ...sh, width: '100%', height: '18px' }} />
                    </section>

                    {/* Section 2 skeleton */}
                    <section style={{ padding: '0 20px' }}>
                        <div style={{ ...sh, width: '160px', height: '44px', borderRadius: '999px' }} />
                    </section>

                    {/* Section 3 skeleton */}
                    <section className="glass-card-dark" style={{ margin: '0 20px', minHeight: '450px', borderRadius: '24px', ...sh }} />

                    {/* Section 4 skeleton */}
                    <section className="glass-card" style={{ margin: '0 20px', padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ ...sh, width: '40%', height: '16px' }} />
                        <div style={{ ...sh, width: '60%', height: '16px' }} />
                    </section>
                </>
            ) : isCancelled ? (
                <section className="reveal-up stagger-1" style={{ padding: '0 20px' }}>
                    <div className="glass-card-dark" style={{ padding: '40px 24px', borderRadius: '24px', textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
                        <p className="kinetic-text" style={{ fontSize: '20px', fontWeight: 800, color: '#F5EDE3', margin: '0 0 8px 0', letterSpacing: '-0.05em' }}>Trip Cancelled</p>
                        <p style={{ fontSize: '13px', color: 'rgba(245,237,227,0.5)', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                            The client has cancelled this booking.
                        </p>
                        <button className="btn-premium" onClick={() => navigate('/driver/trips')} style={{ background: '#6C63FF', padding: '14px 32px' }}>
                            Back to Trips
                        </button>
                    </div>
                </section>
            ) : (
                <>
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

                {trip.flight_number && (() => {
                    const fStatus = FLIGHT_STATUS[flightInfo?.flight_status] || null;
                    const hasDetails = flightInfo?.found;
                    const hasBottom = hasDetails || (flightError && !hasDetails);
                    const depTime = flightInfo?.departure?.actual || flightInfo?.departure?.estimated || flightInfo?.departure?.scheduled;
                    const arrTime = flightInfo?.arrival?.actual || flightInfo?.arrival?.estimated || flightInfo?.arrival?.scheduled;
                    return (
                        <div style={{ marginTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(13,13,13,0.04)', padding: '12px 16px', borderRadius: hasBottom ? '12px 12px 0 0' : '12px' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-dark)', fontWeight: 600 }}>✈ {trip.flight_number}</span>
                                {flightLoading ? (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Checking…</span>
                                ) : fStatus ? (
                                    <span style={{ background: fStatus.bg, color: fStatus.color, padding: '4px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{fStatus.label}</span>
                                ) : (
                                    <span style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF', padding: '4px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: 700 }}>TRACKING</span>
                                )}
                            </div>
                            {hasDetails && (
                                <div style={{ background: 'rgba(13,13,13,0.04)', borderTop: '1px solid rgba(13,13,13,0.06)', padding: '12px 16px', borderRadius: '0 0 12px 12px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>From</span>
                                        <span style={{ color: 'var(--text-dark)', textAlign: 'right' }}>{flightInfo.departure.airport || flightInfo.departure.iata || '—'}</span>
                                    </div>
                                    {depTime && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {flightInfo.departure.actual ? 'Departed' : flightInfo.departure.estimated ? 'Est. Dep.' : 'Sched. Dep.'}
                                            </span>
                                            <span style={{ color: 'var(--text-dark)', fontWeight: 700, fontFamily: 'monospace' }}>{formatEATDate(depTime)}</span>
                                        </div>
                                    )}
                                    <div style={{ borderTop: '1px solid rgba(13,13,13,0.06)', margin: '2px 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Arriving</span>
                                        <span style={{ color: 'var(--text-dark)', textAlign: 'right' }}>{flightInfo.arrival.airport || flightInfo.arrival.iata || '—'}</span>
                                    </div>
                                    {arrTime && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {flightInfo.arrival.actual ? 'Landed' : flightInfo.arrival.estimated ? 'Est. Arr.' : 'Sched. Arr.'}
                                            </span>
                                            <span style={{ color: flightInfo.arrival.delay > 0 ? '#F59E0B' : 'var(--text-dark)', fontWeight: 700, fontFamily: 'monospace' }}>{formatEATDate(arrTime)}</span>
                                        </div>
                                    )}
                                    {flightInfo.arrival.delay > 0 && (
                                        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                            <span style={{ color: '#F59E0B', fontWeight: 700 }}>⚠ Delay</span>
                                            <span style={{ color: '#F59E0B', fontWeight: 700 }}>+{flightInfo.arrival.delay} min</span>
                                        </div>
                                    )}
                                    {(flightInfo.arrival.terminal || flightInfo.arrival.gate) && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Terminal / Gate</span>
                                            <span style={{ color: 'var(--text-dark)', fontWeight: 600 }}>
                                                {[flightInfo.arrival.terminal && `T${flightInfo.arrival.terminal}`, flightInfo.arrival.gate && `G${flightInfo.arrival.gate}`].filter(Boolean).join(' · ')}
                                            </span>
                                        </div>
                                    )}
                                    <button onClick={loadFlight} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textAlign: 'right', padding: 0, alignSelf: 'flex-end' }}>↻ Refresh</button>
                                </div>
                            )}
                            {flightError && !hasDetails && (
                                <div style={{ background: 'rgba(224,90,90,0.07)', borderTop: '1px solid rgba(224,90,90,0.15)', padding: '10px 16px', borderRadius: '0 0 12px 12px', fontSize: '12px', color: '#E05A5A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{flightError}</span>
                                    <button onClick={loadFlight} style={{ background: 'none', border: 'none', color: '#E05A5A', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Retry</button>
                                </div>
                            )}
                        </div>
                    );
                })()}
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

            {/* Section 4: Manager Direct Messages */}
            {isInProgress && (
                <section className="glass-card-dark reveal-up stagger-4" style={{ margin: '0 20px', padding: '24px', borderRadius: '24px', border: '1px solid rgba(108,99,255,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#6C63FF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Manager Channel</span>
                        <span style={{ fontSize: '11px', color: 'rgba(245,237,227,0.35)', fontWeight: 600 }}>— private, not visible to client</span>
                    </div>

                    {/* Message list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', marginBottom: '16px' }}>
                        {dms.length === 0 ? (
                            <p style={{ fontSize: '12px', color: 'rgba(245,237,227,0.3)', textAlign: 'center', margin: '12px 0' }}>No messages yet. Send one below.</p>
                        ) : dms.map((dm) => {
                            const isMe = dm.sender_role === 'driver';
                            return (
                                <div key={dm.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                    <div style={{
                                        maxWidth: '82%',
                                        background: isMe ? 'rgba(108,99,255,0.25)' : 'rgba(255,255,255,0.08)',
                                        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                        padding: '10px 14px',
                                    }}>
                                        <p style={{ fontSize: '13px', color: 'rgba(245,237,227,0.9)', margin: 0, lineHeight: 1.5 }}>{dm.body}</p>
                                    </div>
                                    <span style={{ fontSize: '10px', color: 'rgba(245,237,227,0.25)', marginTop: '3px', marginLeft: '4px', marginRight: '4px' }}>
                                        {isMe ? 'You' : 'Manager'} · {formatEAT(dm.created_at)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Input */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <textarea
                            value={dmInput}
                            onChange={(e) => setDmInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendDm(); } }}
                            placeholder="Message manager…"
                            rows={2}
                            style={{
                                flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '14px', padding: '12px 14px', fontSize: '13px', color: '#F5EDE3',
                                resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5
                            }}
                        />
                        <button
                            onClick={handleSendDm}
                            disabled={sendingDm || !dmInput.trim()}
                            style={{
                                background: sendingDm || !dmInput.trim() ? 'rgba(108,99,255,0.3)' : '#6C63FF',
                                border: 'none', borderRadius: '14px', padding: '0 18px',
                                color: '#fff', fontSize: '18px', cursor: sendingDm || !dmInput.trim() ? 'default' : 'pointer',
                                transition: 'background 0.2s'
                            }}
                        >↑</button>
                    </div>
                </section>
            )}

            {/* Section 5: Trip Details */}
            <section className="glass-card reveal-up stagger-4" style={{ margin: '0 20px', padding: '24px', borderRadius: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 16px 0' }}>Manifest Details</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Reference</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-dark)' }}>{trip.id || 'N/A'}</div>
                    </div>

                    {trip.notes && (
                        <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(108,99,255,0.07)', border: '1px solid rgba(108,99,255,0.18)' }}>
                            <div style={{ fontSize: '11px', color: '#6C63FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Manager Instructions</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-dark)', lineHeight: 1.5 }}>{trip.notes}</div>
                        </div>
                    )}

                    {trip.additional_info && (
                        <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(13,13,13,0.05)', border: '1px solid rgba(13,13,13,0.08)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Client Notes</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-dark)', lineHeight: 1.5 }}>{trip.additional_info}</div>
                        </div>
                    )}
                </div>
            </section>

            {/* Section 5: Trip Review (complaint visibility) */}
            {complaint !== null && (
                <section className="reveal-up stagger-4" style={{ margin: '0 20px' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '20px',
                        padding: '24px',
                        marginTop: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Trip Review</h3>
                            <span style={{
                                background: complaint.status === 'under_investigation' ? 'rgba(108,99,255,0.2)' : complaint.status === 'resolved' ? 'rgba(0,245,160,0.15)' : complaint.status === 'escalated' ? 'rgba(224,90,90,0.2)' : 'rgba(245,158,11,0.2)',
                                color: complaint.status === 'under_investigation' ? '#6C63FF' : complaint.status === 'resolved' ? '#00F5A0' : complaint.status === 'escalated' ? '#E05A5A' : '#F59E0B',
                                borderRadius: '999px', padding: '4px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em'
                            }}>{complaint.status.replace(/_/g, ' ')}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{complaint.category.replace(/_/g, ' ')}</p>
                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: complaint.investigation_notes ? '16px' : 0 }}>{complaint.description}</p>
                        {complaint.investigation_notes && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Manager Notes</p>
                                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, margin: 0 }}>{complaint.investigation_notes}</p>
                            </div>
                        )}
                    </div>
                </section>
            )}
                </>
            )}
        </div>
    );
}
