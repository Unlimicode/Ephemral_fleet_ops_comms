import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import BookingCard from '../../components/BookingCard.jsx';
import ActiveTripCard from '../../components/ActiveTripCard.jsx';
import useWindowWidth from '../../hooks/useWindowWidth.js';

const GLASS = {
    background: 'rgba(255,255,255,0.55)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.7)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    borderRadius: '2rem',
    transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease',
};

const GLASS_HOVER = {
    transform: 'translateY(-4px)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
};

export default function ManagerDispatchPage() {
    const { token } = useAuth();
    const { addToast } = useToast();
    const width = useWindowWidth();
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

    const [trips, setTrips] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [confirmingTripId, setConfirmingTripId] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [showNewBooking, setShowNewBooking] = useState(false);
    const [submittingBooking, setSubmittingBooking] = useState(false);
    const [newBookingForm, setNewBookingForm] = useState({
        client_corporate_email: '', client_first_name: '',
        pickup_location: '', destination: '',
        pickup_time: '', flight_number: '', notes: '',
        send_magic_link: true
    });

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
        socket.on('trip_rejected', fetchData);
        socket.on('session_created', fetchData);
        socket.on('session_destroyed', fetchData);
        socket.on('complaint_filed', fetchData);
        socket.on('booking_updated', fetchData);
        socket.on('booking_cancelled', fetchData);

        return () => {
            clearInterval(pollInterval);
            socket.disconnect();
        };
    }, [fetchData, token]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchData();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [fetchData]);

    const handleAssign = async (tripId, driverId, vehicleId, eta = null) => {
        try {
            await api.patch(`/trips/${tripId}/assign`, { driver_id: driverId, vehicle_id: vehicleId, eta });
            await fetchData();
            addToast('Trip assigned successfully.', 'success');
        } catch (err) {
            addToast(err.response?.data?.error || err.response?.data?.message || 'Assignment failed.', 'error');
        }
    };

    const handleComplete = async (tripId) => {
        setCompleting(true);
        try {
            await api.patch(`/trips/${tripId}/force-complete`);
            await fetchData();
            addToast('Trip marked as complete.', 'success');
        } catch (err) {
            addToast(err.response?.data?.error || err.response?.data?.message || 'Failed to complete trip.', 'error');
        } finally {
            setCompleting(false);
        }
    };

    const handleNewBooking = async (e) => {
        e.preventDefault();
        setSubmittingBooking(true);
        try {
            const payload = {
                client_corporate_email: newBookingForm.client_corporate_email.trim(),
                client_first_name: newBookingForm.client_first_name.trim(),
                pickup_location: newBookingForm.pickup_location.trim(),
                destination: newBookingForm.destination.trim(),
                pickup_time: newBookingForm.pickup_time,
                flight_number: newBookingForm.flight_number.trim() || null,
                notes: newBookingForm.notes.trim() || null,
                send_magic_link: newBookingForm.send_magic_link,
            };
            await api.post('/trips', payload);
            addToast('Booking created successfully.', 'success');
            setShowNewBooking(false);
            setNewBookingForm({ client_corporate_email: '', client_first_name: '', pickup_location: '', destination: '', pickup_time: '', flight_number: '', notes: '', send_magic_link: true });
            await fetchData();
        } catch (err) {
            addToast(err.response?.data?.error || 'Failed to create booking.', 'error');
        } finally {
            setSubmittingBooking(false);
        }
    };

    const pendingTrips     = trips.filter(t => t.status === 'pending');
    const assignedTrips    = trips.filter(t => t.status === 'accepted' || t.status === 'assigned');
    const activeTrips      = trips.filter(t => t.status === 'in_progress');
    const completedTrips   = trips.filter(t => t.status === 'completed').slice(0, 10);
    const availableDrivers = drivers.filter(d => d.availability_status === 'available');
    const deployedVehicles = activeTrips.length;

    /* ── Helper functions ─────────────────────────────────────── */
    const timeAgo = (dateStr) => {
        if (!dateStr) return '';
        const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
    };

    const urgencyColor = (pickupTime) => {
        if (!pickupTime) return '#6C63FF';
        const mins = (new Date(pickupTime) - Date.now()) / 60000;
        if (mins < 0) return '#E05A5A';
        if (mins < 120) return '#E05A5A';
        if (mins < 360) return '#F59E0B';
        return '#6C63FF';
    };

    const nextPickupLabel = (pickupTime) => {
        if (!pickupTime) return '';
        const mins = Math.floor((new Date(pickupTime) - Date.now()) / 60000);
        if (mins < 0) return 'Overdue';
        if (mins < 60) return `${mins}m away`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m away`;
    };

    return (
        <>
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-30px) rotate(8deg); }
                }
                @keyframes float-reverse {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(20px) rotate(-6deg); }
                }
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(0.85); }
                }
                .dispatch-card {
                    background: rgba(255,255,255,0.35);
                    backdrop-filter: blur(60px) saturate(200%);
                    -webkit-backdrop-filter: blur(60px) saturate(200%);
                    border: 1px solid rgba(255,255,255,0.75);
                    box-shadow: 0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9);
                    border-radius: 2rem;
                    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease;
                }
                .dispatch-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 16px 48px rgba(0,0,0,0.12);
                }
                .geo-float-1 { animation: float-slow 11s ease-in-out infinite; }
                .geo-float-2 { animation: float-reverse 9s ease-in-out infinite; }
                .geo-float-3 { animation: float-slow 13s ease-in-out infinite; }
                .dispatch-shimmer {
                    background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.4) 100%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite linear;
                    border-radius: 2rem;
                    border: 1px solid rgba(255,255,255,0.5);
                }
            `}</style>

            {/* Fixed background layer */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                {/* Arch grid */}
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.55,
                    backgroundImage: 'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
                    backgroundSize: '80px 80px'
                }} />
                {/* Geo triangle 1 — top left */}
                <div className="geo-float-1" style={{ position: 'absolute', top: '12%', left: '4%', color: 'rgba(108,99,255,0.12)', pointerEvents: 'none' }}>
                    <div style={{ width: 0, height: 0, borderLeft: '120px solid transparent', borderRight: '120px solid transparent', borderBottom: '180px solid currentColor', transform: 'rotate(12deg) scale(1.5)' }} />
                </div>
                {/* Geo triangle 2 — bottom right */}
                <div className="geo-float-2" style={{ position: 'absolute', bottom: '8%', right: '6%', color: 'rgba(108,99,255,0.10)', pointerEvents: 'none' }}>
                    <div style={{ width: 0, height: 0, borderLeft: '100px solid transparent', borderRight: '100px solid transparent', borderBottom: '150px solid currentColor', transform: 'rotate(-15deg) scale(1.8)' }} />
                </div>
                {/* Geo triangle 3 — mid right */}
                <div className="geo-float-3" style={{ position: 'absolute', top: '40%', right: '18%', color: 'rgba(0,212,255,0.08)', pointerEvents: 'none' }}>
                    <div style={{ width: 0, height: 0, borderLeft: '60px solid transparent', borderRight: '60px solid transparent', borderBottom: '90px solid currentColor', transform: 'rotate(25deg)' }} />
                </div>
            </div>

            {/* Page content */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: '1440px', margin: '0 auto', padding: isMobile ? '12px 16px 80px' : '16px 40px 80px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>

                {/* LOADING STATE */}
                {loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '24px' }}>
                        {[...Array(7)].map((_, i) => (
                            <div key={i} className="dispatch-shimmer" style={{ height: i === 0 || i === 4 ? '220px' : '160px', gridColumn: i === 4 ? 'span 3' : 'span 1' }} />
                        ))}
                    </div>
                )}

                {/* ERROR STATE */}
                {!loading && error && (
                    <div className="dispatch-card" style={{ padding: '32px', borderLeft: '3px solid #E05A5A', maxWidth: '480px' }}>
                        <p style={{ fontSize: '14px', color: '#0D0D0D', marginBottom: '16px' }}>{error}</p>
                        <button onClick={() => { setError(''); fetchData(); }} style={{ background: '#6C63FF', color: 'white', border: 'none', borderRadius: '999px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                            Retry
                        </button>
                    </div>
                )}

                {/* MAIN CONTENT */}
                {!loading && !error && (
                    <>
                        {/* Header */}
                        <header style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: isMobile ? '36px' : '48px', fontWeight: 900, letterSpacing: '-0.03em', color: '#0D0D0D', marginBottom: '6px', textTransform: 'uppercase' }}>
                                    Dispatch
                                </h1>
                                <button
                                    onClick={() => setShowNewBooking(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '999px', background: '#6C63FF', border: 'none', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(108,99,255,0.35)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                    New Booking
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>
                                    Real-time Command Operations Center
                                </p>
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '999px', background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.75)' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: socketConnected ? '#00F5A0' : '#A0A0A0', boxShadow: socketConnected ? '0 0 8px rgba(0,245,160,0.6)' : 'none', animation: socketConnected ? 'pulse-dot 2s infinite' : 'none', display: 'inline-block' }} />
                                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {socketConnected ? 'Live' : 'Offline'}
                                    </span>
                                </div>
                            </div>
                        </header>

                        {/* BENTO GRID */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: '24px' }}>

                            {/* COL 1: Active Trips + Pending */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {/* Active Trips */}
                                <div className="dispatch-card" style={{ padding: '32px', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>Active Trips</span>
                                        <span className="material-symbols-outlined" style={{ color: '#6C63FF', fontSize: '20px' }}>near_me</span>
                                    </div>
                                    {activeTrips.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                            <p style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(0,0,0,0.25)' }}>All systems clear</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {activeTrips.map(trip => (
                                                <div key={trip.id} style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '16px', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.8)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0D0D0D' }}>{trip.driver_name || 'Driver'}</p>
                                                            <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.45)', marginTop: '2px' }}>{trip.vehicle_reg || 'Vehicle'}</p>
                                                        </div>
                                                        {confirmingTripId === trip.id ? (
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button onClick={async () => { await handleComplete(trip.id); setConfirmingTripId(null); }} disabled={completing} style={{ background: '#6C63FF', color: 'white', border: 'none', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: completing ? 'not-allowed' : 'pointer', opacity: completing ? 0.6 : 1 }}>{completing ? 'Completing...' : 'Confirm'}</button>
                                                                <button onClick={() => setConfirmingTripId(null)} style={{ background: 'rgba(0,0,0,0.08)', color: '#0D0D0D', border: 'none', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setConfirmingTripId(trip.id)} style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF', border: 'none', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Complete</button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Pending */}
                                <div className="dispatch-card" style={{ padding: '32px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>Pending</span>
                                        <span className="material-symbols-outlined" style={{ color: 'rgba(0,0,0,0.2)', fontSize: '20px' }}>schedule</span>
                                    </div>
                                    <div style={{ marginTop: '16px' }}>
                                        <span style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '64px', fontWeight: 900, letterSpacing: '-0.03em', color: pendingTrips.length > 0 ? '#F59E0B' : 'rgba(0,0,0,0.25)', lineHeight: 1 }}>{pendingTrips.length}</span>
                                    </div>
                                    {pendingTrips.length > 0 && (
                                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#0D0D0D' }}>{pendingTrips[0].pickup_location}</p>
                                            <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.45)', marginTop: '2px' }}>→ {pendingTrips[0].destination}</p>
                                            <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: urgencyColor(pendingTrips[0].pickup_time), marginTop: '6px', fontWeight: 700 }}>{nextPickupLabel(pendingTrips[0].pickup_time)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* COL 2 & 3: Incoming Bookings */}
                            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                                <div className="dispatch-card" style={{ padding: '40px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                        <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '18px', fontWeight: 800, color: '#0D0D0D', letterSpacing: '-0.02em' }}>Incoming Bookings</h2>
                                        <span style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF', borderRadius: '999px', padding: '4px 12px', fontSize: '12px', fontWeight: 700 }}>{pendingTrips.length}</span>
                                    </div>
                                    {pendingTrips.length === 0 ? (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'rgba(0,0,0,0.2)' }}>draft</span>
                                            </div>
                                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0D0D0D', marginBottom: '8px' }}>No pending bookings</h3>
                                            <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.45)', maxWidth: '280px' }}>New corporate trip requests will appear here in real-time</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                            {pendingTrips.map(booking => (
                                                <BookingCard key={booking.id} booking={booking} drivers={drivers} vehicles={vehicles} onAssign={handleAssign} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* COL 4: Drivers + Fleet */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {/* Drivers */}
                                <div className="dispatch-card" style={{ padding: '32px', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>Drivers</span>
                                        <span className="material-symbols-outlined" style={{ color: 'rgba(0,0,0,0.2)', fontSize: '20px' }}>group</span>
                                    </div>
                                    {/* Driver presence cluster */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                                        {drivers.map(d => (
                                            <div key={d.driver_id} title={d.full_name} style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '13px', fontWeight: 800,
                                                cursor: 'default',
                                                background: d.availability_status === 'available' ? 'linear-gradient(135deg, #6C63FF, #8B85FF)'
                                                    : d.availability_status === 'on_trip' ? 'linear-gradient(135deg, #00D4FF, #00F5A0)'
                                                    : 'rgba(0,0,0,0.12)',
                                                color: d.availability_status === 'on_trip' ? '#0D0D0D' : d.availability_status === 'available' ? 'white' : 'rgba(0,0,0,0.4)',
                                                boxShadow: d.availability_status === 'available' ? '0 4px 12px rgba(108,99,255,0.35)'
                                                    : d.availability_status === 'on_trip' ? '0 4px 12px rgba(0,212,255,0.3)'
                                                    : 'none',
                                            }}>
                                                {d.full_name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Legend */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                        {[
                                            { label: 'Available', count: availableDrivers.length, color: '#6C63FF' },
                                            { label: 'On Trip', count: drivers.filter(d => d.availability_status === 'on_trip').length, color: '#00D4FF' },
                                            { label: 'Offline', count: drivers.filter(d => d.availability_status === 'offline').length, color: 'rgba(0,0,0,0.2)' },
                                        ].map(({ label, count, color }) => (
                                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                                                    <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(0,0,0,0.45)' }}>{label}</span>
                                                </div>
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0D0D0D' }}>{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Fleet */}
                                <div className="dispatch-card" style={{ padding: '32px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>Fleet Status</span>
                                        <span className="material-symbols-outlined" style={{ color: 'rgba(0,0,0,0.2)', fontSize: '20px' }}>local_shipping</span>
                                    </div>
                                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                        <span style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '56px', fontWeight: 900, letterSpacing: '-0.03em', color: '#6C63FF', lineHeight: 1 }}>{deployedVehicles}</span>
                                        <span style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '28px', fontWeight: 700, color: 'rgba(0,0,0,0.2)' }}>/ {vehicles.length}</span>
                                    </div>
                                    <div style={{ marginTop: '16px', width: '100%', height: '4px', borderRadius: '999px', background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #6C63FF, #00D4FF)', width: `${(deployedVehicles / Math.max(vehicles.length, 1)) * 100}%`, transition: 'width 0.8s ease' }} />
                                    </div>
                                    <p style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(0,0,0,0.4)', fontWeight: 500 }}>vehicles deployed</p>
                                </div>
                            </div>

                            {/* BOTTOM ROW: Active Trip Stream */}
                            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 3' }}>
                                <div className="dispatch-card" style={{ padding: '32px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                        <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '18px', fontWeight: 800, color: '#0D0D0D', letterSpacing: '-0.02em' }}>Active Trips</h2>
                                        <span style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF', borderRadius: '999px', padding: '4px 12px', fontSize: '12px', fontWeight: 700 }}>{activeTrips.length}</span>
                                    </div>
                                    {activeTrips.length === 0 ? (
                                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.3)', fontStyle: 'italic', padding: '16px 0' }}>No active trips right now</p>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                                            {activeTrips.map(trip => (
                                                <ActiveTripCard key={trip.id} trip={trip} onComplete={() => setConfirmingTripId(trip.id)} isConfirming={confirmingTripId === trip.id} onConfirm={async () => { await handleComplete(trip.id); setConfirmingTripId(null); }} onCancel={() => setConfirmingTripId(null)} completing={completing} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* BOTTOM ROW: Awaiting Acceptance */}
                            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 1' }}>
                                <div className="dispatch-card" style={{ padding: '32px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'relative', zIndex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>Awaiting</span>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00F5A0', display: 'inline-block', boxShadow: '0 0 8px rgba(0,245,160,0.6)', animation: 'pulse-dot 2s infinite' }} />
                                        </div>
                                        {assignedTrips.length === 0 ? (
                                            <div>
                                                <span style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '48px', fontWeight: 900, color: '#0D0D0D', letterSpacing: '-0.03em', lineHeight: 1 }}>0</span>
                                                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)', marginTop: '8px' }}>All clear</p>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {assignedTrips.map(t => {
                                                    const mins = Math.floor((Date.now() - new Date(t.updated_at)) / 60000);
                                                    const barColor = mins < 10 ? '#6C63FF' : mins < 20 ? '#F59E0B' : '#E05A5A';
                                                    const barWidth = Math.max(0, (1 - mins / 30) * 100);
                                                    return (
                                                        <div key={t.id} style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '14px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div>
                                                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0D0D0D' }}>{t.driver_name || 'Driver'}</p>
                                                                <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.45)', marginTop: '2px' }}>{t.vehicle_reg || 'Vehicle'}</p>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', fontFamily: 'JetBrains Mono, monospace' }}>{timeAgo(t.updated_at)}</p>
                                                                <div style={{ width: '60px', height: '3px', borderRadius: '999px', background: 'rgba(0,0,0,0.08)', marginTop: '6px' }}>
                                                                    <div style={{ height: '100%', borderRadius: '999px', background: barColor, width: `${barWidth}%`, transition: 'width 0.3s ease' }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    {/* Background accent icon */}
                                    <div style={{ position: 'absolute', right: '-8px', bottom: '-8px', opacity: 0.03, pointerEvents: 'none' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '120px' }}>verified_user</span>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Recent Completed */}
                        {completedTrips.length > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                    <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '18px', fontWeight: 800, color: '#0D0D0D', letterSpacing: '-0.02em' }}>Recent Completed</h2>
                                    <span style={{ background: 'rgba(0,245,160,0.1)', color: '#00A86B', borderRadius: '999px', padding: '4px 12px', fontSize: '12px', fontWeight: 700 }}>{completedTrips.length}</span>
                                </div>
                                <div className="dispatch-card" style={{ padding: '0', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                                {['Trip ID', 'Client', 'Route', 'Driver', 'Vehicle', 'Completed'].map(h => (
                                                    <th key={h} style={{ padding: '12px 20px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', textAlign: 'left' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {completedTrips.map((t, i) => (
                                                <tr key={t.id} style={{ borderBottom: i < completedTrips.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', transition: 'background 0.2s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.5)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    <td style={{ padding: '14px 20px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(0,0,0,0.5)' }}>{t.id.slice(0, 8).toUpperCase()}</td>
                                                    <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#0D0D0D' }}>{t.client_first_name || '—'}</td>
                                                    <td style={{ padding: '14px 20px', fontSize: '12px', color: 'rgba(0,0,0,0.55)' }}>{t.pickup_location} → {t.destination}</td>
                                                    <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#0D0D0D' }}>{t.driver_name || '—'}</td>
                                                    <td style={{ padding: '14px 20px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(0,0,0,0.4)' }}>{t.vehicle_reg || '—'}</td>
                                                    <td style={{ padding: '14px 20px', fontSize: '11px', color: 'rgba(0,0,0,0.4)', fontFamily: 'JetBrains Mono, monospace' }}>
                                                        {t.updated_at ? new Date(t.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + new Date(t.updated_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* New Booking Modal */}
                        {showNewBooking && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(13,13,13,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                                onClick={(e) => { if (e.target === e.currentTarget) setShowNewBooking(false); }}>
                                <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(60px)', WebkitBackdropFilter: 'blur(60px)', borderRadius: '2rem', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 24px 80px rgba(0,0,0,0.18)', width: '100%', maxWidth: '560px', padding: isMobile ? '28px 20px' : '40px', fontFamily: "'Be Vietnam Pro', sans-serif", maxHeight: '90vh', overflowY: 'auto' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                                        <div>
                                            <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: '4px' }}>New Booking</h2>
                                            <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', fontWeight: 600, letterSpacing: '0.04em' }}>Create a corporate trip booking</p>
                                        </div>
                                        <button onClick={() => setShowNewBooking(false)} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'rgba(0,0,0,0.5)' }}>close</span>
                                        </button>
                                    </div>
                                    <form onSubmit={handleNewBooking} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {/* Client fields */}
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: '6px' }}>First Name *</label>
                                                <input required value={newBookingForm.client_first_name} onChange={e => setNewBookingForm(f => ({ ...f, client_first_name: e.target.value }))}
                                                    placeholder="e.g. James"
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: '14px', color: '#0D0D0D', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: '6px' }}>Corporate Email *</label>
                                                <input required type="email" value={newBookingForm.client_corporate_email} onChange={e => setNewBookingForm(f => ({ ...f, client_corporate_email: e.target.value }))}
                                                    placeholder="client@company.com"
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: '14px', color: '#0D0D0D', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                            </div>
                                        </div>

                                        {/* Route */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: '6px' }}>Pickup Location *</label>
                                            <input required value={newBookingForm.pickup_location} onChange={e => setNewBookingForm(f => ({ ...f, pickup_location: e.target.value }))}
                                                placeholder="e.g. JKIA Terminal 1"
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: '14px', color: '#0D0D0D', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: '6px' }}>Destination *</label>
                                            <input required value={newBookingForm.destination} onChange={e => setNewBookingForm(f => ({ ...f, destination: e.target.value }))}
                                                placeholder="e.g. Westlands, Nairobi"
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: '14px', color: '#0D0D0D', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                        </div>

                                        {/* Pickup time + flight number */}
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: '6px' }}>Pickup Time *</label>
                                                <input required type="datetime-local" value={newBookingForm.pickup_time} onChange={e => setNewBookingForm(f => ({ ...f, pickup_time: e.target.value }))}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: '14px', color: '#0D0D0D', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: '6px' }}>Flight Number</label>
                                                <input value={newBookingForm.flight_number} onChange={e => setNewBookingForm(f => ({ ...f, flight_number: e.target.value }))}
                                                    placeholder="e.g. KQ101"
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: '14px', color: '#0D0D0D', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: '6px' }}>Special Instructions</label>
                                            <textarea value={newBookingForm.notes} onChange={e => setNewBookingForm(f => ({ ...f, notes: e.target.value }))}
                                                rows={3} placeholder="Any special requirements for the driver..."
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: '14px', color: '#0D0D0D', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', minHeight: '80px' }} />
                                        </div>

                                        {/* Magic link toggle */}
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '14px 16px', borderRadius: '14px', background: 'rgba(108,99,255,0.05)', border: '1px solid rgba(108,99,255,0.12)' }}>
                                            <input type="checkbox" checked={newBookingForm.send_magic_link} onChange={e => setNewBookingForm(f => ({ ...f, send_magic_link: e.target.checked }))}
                                                style={{ width: '16px', height: '16px', accentColor: '#6C63FF', cursor: 'pointer', flexShrink: 0 }} />
                                            <div>
                                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0D0D0D', marginBottom: '2px' }}>Send booking access link</p>
                                                <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.45)' }}>Email a magic link to the client so they can track their trip</p>
                                            </div>
                                        </label>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                                            <button type="button" onClick={() => setShowNewBooking(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'transparent', border: '1px solid rgba(0,0,0,0.12)', color: 'rgba(0,0,0,0.6)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                                Cancel
                                            </button>
                                            <button type="submit" disabled={submittingBooking} style={{ flex: 2, padding: '12px', borderRadius: '12px', background: '#6C63FF', border: 'none', color: 'white', fontSize: '14px', fontWeight: 700, cursor: submittingBooking ? 'not-allowed' : 'pointer', opacity: submittingBooking ? 0.7 : 1, boxShadow: '0 4px 16px rgba(108,99,255,0.35)', fontFamily: 'inherit' }}>
                                                {submittingBooking ? 'Creating...' : 'Create Booking'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Status Footer Ticker */}
                        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(0,0,0,0.05)', height: '40px', display: 'flex', alignItems: 'center', paddingLeft: '32px', gap: '40px' }}>
                            {[
                                { dot: '#00F5A0', label: 'System Online' },
                                { dot: null, label: `Fleet Sync: ${vehicles.length > 0 ? '100%' : '—'}` },
                                { dot: null, label: 'Region: Nairobi, Kenya' },
                            ].map(({ dot, label }) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {dot && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot, display: 'inline-block' }} />}
                                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', fontFamily: "'Be Vietnam Pro', sans-serif" }}>{label}</span>
                                </div>
                            ))}
                        </div>

                    </>
                )}
            </div>
        </>
    );
}
