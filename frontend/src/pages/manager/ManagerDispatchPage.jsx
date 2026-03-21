import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import BookingCard from '../../components/BookingCard.jsx';
import ActiveTripCard from '../../components/ActiveTripCard.jsx';
import useWindowWidth from '../../hooks/useWindowWidth.js';

const CARD = {
    background: 'rgba(255,255,255,0.25)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    border: '1px solid rgba(255,255,255,0.5)',
    boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
};

const SHIMMER = {
    background: 'linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.4) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite linear',
    border: '1px solid rgba(255,255,255,0.5)',
};

const LABEL = {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#A0A0A0',
};

export default function ManagerDispatchPage() {
    const { token } = useAuth();
    const { addToast } = useToast();
    const width = useWindowWidth();
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;

    const [trips, setTrips] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [confirmingTripId, setConfirmingTripId] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [tripsRes, driversRes, vehiclesRes] = await Promise.all([
                api.get('/trips'),
                api.get('/roster/drivers'),
                api.get('/vehicles')
            ]);
            setTrips(Array.isArray(tripsRes.data) ? tripsRes.data : tripsRes.data.trips || []);
            setDrivers(Array.isArray(driversRes.data) ? driversRes.data : driversRes.data.drivers || []);
            setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : vehiclesRes.data.vehicles || []);
        } catch {
            setError('Failed to fetch dispatch data. Please check your connection.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const pollInterval = setInterval(fetchData, 30000);

        if (!token) return;

        const socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/dashboard`, {
            auth: { token }
        });

        socket.on('connect', () => setSocketConnected(true));
        socket.on('disconnect', () => setSocketConnected(false));
        socket.on('trip_assigned', fetchData);
        socket.on('session_created', fetchData);
        socket.on('session_destroyed', fetchData);
        socket.on('complaint_filed', fetchData);

        return () => {
            clearInterval(pollInterval);
            socket.disconnect();
        };
    }, [fetchData, token]);

    const handleAssign = async (tripId, driverId, vehicleId) => {
        try {
            await api.patch(`/trips/${tripId}/assign`, { driver_id: driverId, vehicle_id: vehicleId });
            fetchData();
        } catch (err) {
            addToast(err.response?.data?.message || 'Assignment failed.', 'error');
        }
    };

    const handleComplete = async (tripId) => {
        try {
            await api.patch(`/trips/${tripId}/force-complete`);
            fetchData();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to complete trip.', 'error');
        }
    };

    const pendingTrips     = trips.filter(t => t.status === 'pending');
    const assignedTrips    = trips.filter(t => t.status === 'accepted' || t.status === 'assigned');
    const activeTrips      = trips.filter(t => t.status === 'in_progress');
    const availableDrivers = drivers.filter(d => d.availability_status === 'available');
    const deployedVehicles = activeTrips.length;

    /* ── Metrics grid column template ─────────────────────────── */
    const metricsGrid = isDesktop
        ? '2fr 1fr 1fr 1fr'
        : isTablet
            ? 'repeat(2, 1fr)'
            : '1fr';

    /* ── Loading skeleton ─────────────────────────────────────── */
    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                <style>{`@keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }`}</style>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ ...SHIMMER, width: '160px', height: '40px', borderRadius: '12px' }} />
                    <div style={{ ...SHIMMER, width: '88px', height: '32px', borderRadius: '999px' }} />
                </div>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: metricsGrid, gap: '16px' }}>
                    <div style={{ ...SHIMMER, height: '160px', borderRadius: '24px' }} />
                    <div style={{ ...SHIMMER, height: '160px', borderRadius: '24px' }} />
                    <div style={{ ...SHIMMER, height: '160px', borderRadius: '24px' }} />
                    <div style={{ ...SHIMMER, height: '160px', borderRadius: '24px' }} />
                </div>

                {/* Bookings */}
                <div style={{ ...SHIMMER, height: '120px', borderRadius: '24px' }} />

                {/* Bottom row */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: '24px' }}>
                    <div style={{ ...SHIMMER, height: '200px', borderRadius: '24px' }} />
                    <div style={{ ...SHIMMER, height: '200px', borderRadius: '24px' }} />
                </div>
            </div>
        );
    }

    /* ── Error state ─────────────────────────────────────────── */
    if (error) {
        return (
            <div style={{
                ...CARD, padding: '32px', borderRadius: '24px',
                borderLeft: '3px solid #E05A5A',
                maxWidth: '480px', margin: '40px auto'
            }}>
                <p style={{ fontSize: '14px', color: '#0D0D0D', margin: '0 0 0 0' }}>{error}</p>
                <button
                    onClick={fetchData}
                    style={{
                        marginTop: '16px', padding: '8px 20px', borderRadius: '999px', border: 'none',
                        background: '#6C63FF', color: '#FFF', fontSize: '13px',
                        fontWeight: 600, cursor: 'pointer', display: 'block'
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    /* ── Section header helper ───────────────────────────────── */
    const SectionHeader = ({ title, count, badgeColor = '#6C63FF', badgeBg = 'rgba(108,99,255,0.1)' }) => (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0D0D0D', margin: 0 }}>{title}</h2>
            <span style={{
                background: badgeBg, color: badgeColor,
                borderRadius: '999px', padding: '2px 10px',
                fontSize: '12px', fontWeight: 700, marginLeft: '8px'
            }}>{count}</span>
        </div>
    );

    /* ── Empty state helper ──────────────────────────────────── */
    const EmptyState = ({ icon, title, subtitle, iconBg = 'rgba(108,99,255,0.1)' }) => (
        <div style={{ ...CARD, padding: '48px 24px', borderRadius: '24px', textAlign: 'center' }}>
            <div style={{
                width: '72px', height: '72px', borderRadius: '999px',
                background: iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: '32px'
            }}>{icon}</div>
            <p style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.03em', color: '#0D0D0D', margin: '0 0 6px 0' }}>{title}</p>
            <p style={{ fontSize: '13px', color: '#A0A0A0', margin: 0 }}>{subtitle}</p>
        </div>
    );

    /* ── Main render ─────────────────────────────────────────── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <style>{`@keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }`}</style>

            {/* ── Header row ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{
                    fontSize: '32px', fontWeight: 800, letterSpacing: '-0.05em',
                    color: '#0D0D0D', margin: 0, lineHeight: 1
                }}>
                    Dispatch
                </h1>
                <div style={{
                    ...CARD,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    borderRadius: '9999px', padding: '6px 16px'
                }}>
                    <span className={socketConnected ? 'session-pulse' : ''} style={{
                        width: '8px', height: '8px', borderRadius: '999px', display: 'inline-block',
                        background: socketConnected ? '#6C63FF' : '#A0A0A0'
                    }} />
                    <span style={{
                        fontSize: '12px', color: '#6B6B6B', fontWeight: 600,
                        fontFamily: 'JetBrains Mono, monospace'
                    }}>Live</span>
                </div>
            </div>

            {/* ── Metrics row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: metricsGrid, gap: '16px' }}>

                {/* Card 1 — Active Trips */}
                <div style={{
                    ...CARD, padding: '32px', borderRadius: '24px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={LABEL}>Active Trips</div>
                        <div style={{
                            fontSize: '64px', fontWeight: 800, letterSpacing: '-0.05em',
                            color: '#6C63FF', lineHeight: 1, marginTop: '8px'
                        }}>
                            {activeTrips.length}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6B6B6B', marginTop: '4px' }}>
                            {activeTrips.length === 1 ? 'trip in progress' : 'trips in progress'}
                        </div>
                    </div>
                    <div style={{ marginTop: '24px', background: 'rgba(108,99,255,0.12)', height: '3px', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: '999px',
                            background: 'linear-gradient(90deg, #6C63FF, #00D4FF)',
                            width: `${(activeTrips.length / Math.max(trips.length, 1)) * 100}%`,
                            transition: 'width 0.6s ease'
                        }} />
                    </div>
                </div>

                {/* Card 2 — Pending Bookings */}
                <div style={{ ...CARD, padding: '24px', borderRadius: '24px' }}>
                    <div style={LABEL}>Pending</div>
                    <div style={{
                        fontSize: '48px', fontWeight: 800, letterSpacing: '-0.05em',
                        color: '#F59E0B', lineHeight: 1, marginTop: '8px'
                    }}>
                        {pendingTrips.length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#A0A0A0', marginTop: '4px' }}>awaiting assignment</div>
                </div>

                {/* Card 3 — Drivers */}
                <div style={{ ...CARD, padding: '24px', borderRadius: '24px' }}>
                    <div style={LABEL}>Drivers</div>
                    <div style={{
                        fontSize: '48px', fontWeight: 800, letterSpacing: '-0.05em',
                        color: '#0D0D0D', lineHeight: 1, marginTop: '8px'
                    }}>
                        {drivers.length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#A0A0A0', marginTop: '4px' }}>{availableDrivers.length} available</div>
                </div>

                {/* Card 4 — Fleet Status */}
                <div style={{ ...CARD, padding: '24px', borderRadius: '24px' }}>
                    <div style={LABEL}>Fleet Status</div>
                    <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.06)', height: '8px', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: '999px',
                            background: 'linear-gradient(90deg, #6C63FF, #00D4FF)',
                            width: `${(deployedVehicles / Math.max(vehicles.length, 1)) * 100}%`,
                            transition: 'width 0.6s ease'
                        }} />
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#6B6B6B' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6C63FF', display: 'inline-block' }} />
                                Deployed
                            </div>
                            <span style={{ fontWeight: 600, color: '#0D0D0D' }}>{deployedVehicles}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#6B6B6B' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(0,0,0,0.2)', display: 'inline-block' }} />
                                Available
                            </div>
                            <span style={{ fontWeight: 600, color: '#0D0D0D' }}>{Math.max(vehicles.length - deployedVehicles, 0)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Incoming Bookings ── */}
            <section className="reveal-up stagger-1">
                <SectionHeader title="Incoming Bookings" count={pendingTrips.length} />
                {pendingTrips.length === 0 ? (
                    <EmptyState icon="📋" title="No pending bookings" subtitle="New corporate trip requests will appear here" />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                        {pendingTrips.map((trip, idx) => (
                            <BookingCard
                                key={trip.id}
                                index={idx}
                                booking={trip}
                                drivers={drivers}
                                vehicles={vehicles}
                                onAssign={handleAssign}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* ── Bottom row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: '24px', alignItems: 'start' }}>

                {/* Left — Active Trips */}
                <section className="reveal-up stagger-2">
                    <SectionHeader title="Active Trips" count={activeTrips.length} />
                    {activeTrips.length === 0 ? (
                        <EmptyState icon="🚗" title="No active trips" subtitle="Assigned trips will appear once drivers start" />
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                            {activeTrips.map(trip => (
                                <ActiveTripCard
                                    key={trip.id}
                                    trip={trip}
                                    onComplete={() => setConfirmingTripId(trip.id)}
                                    isConfirming={confirmingTripId === trip.id}
                                    onConfirm={() => { handleComplete(trip.id); setConfirmingTripId(null); }}
                                    onCancel={() => setConfirmingTripId(null)}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Right — Awaiting Acceptance */}
                <section className="reveal-up stagger-3">
                    <SectionHeader
                        title="Awaiting Acceptance"
                        count={assignedTrips.length}
                        badgeColor="#F59E0B"
                        badgeBg="rgba(245,158,11,0.1)"
                    />
                    {assignedTrips.length === 0 ? (
                        <EmptyState
                            icon="⏳"
                            title="All clear"
                            subtitle="No trips awaiting driver acceptance"
                            iconBg="rgba(245,158,11,0.1)"
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {assignedTrips.map(trip => (
                                <div key={trip.id} style={{
                                    ...CARD, padding: '16px', borderRadius: '16px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>
                                            {trip.driver?.full_name || 'Assigned Driver'}
                                        </p>
                                        <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '2px 0 0 0' }}>
                                            {trip.vehicle?.registration_number || 'Vehicle TBD'}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '12px', color: '#A0A0A0', margin: 0 }}>
                                            {trip.updated_at ? new Date(trip.updated_at).toLocaleTimeString() : 'Recently'}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                                            <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 600 }}>Pending</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
