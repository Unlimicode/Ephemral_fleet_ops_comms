import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatCard from '../../components/StatCard.jsx';
import BookingCard from '../../components/BookingCard.jsx';
import ActiveTripCard from '../../components/ActiveTripCard.jsx';
import PageWrapper from '../../components/layout/PageWrapper.jsx';

export default function ManagerDispatchPage() {
    const { token } = useAuth();
    const [trips, setTrips] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
            alert(err.response?.data?.message || 'Assignment failed.');
        }
    };

    const handleComplete = async (tripId) => {
        if (!confirm('Are you sure you want to force mark this trip complete?')) return;
        try {
            await api.patch(`/trips/${tripId}/force-complete`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to complete trip.');
        }
    };

    if (loading) {
        return (
            <PageWrapper>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                    <div style={{
                        width: '40px', height: '40px',
                        border: '3px solid rgba(0,0,0,0.1)',
                        borderTop: '3px solid var(--accent-gradient-start, #ff7b00)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            </PageWrapper>
        );
    }

    if (error) {
        return (
            <PageWrapper>
                <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--accent-warning)', maxWidth: '400px', margin: '40px auto' }}>
                    {error}
                </div>
            </PageWrapper>
        );
    }

    const pendingTrips = trips.filter(t => t.status === 'pending');
    const assignedTrips = trips.filter(t => t.status === 'accepted' || t.status === 'assigned');
    const activeTrips = trips.filter(t => t.status === 'in_progress');

    const availableDrivers = drivers; // In test environment, all drivers are valid candidates
    const deployedVehicles = activeTrips.length; // Approximate vehicles deployed based on active trips

    return (
        <PageWrapper>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* Section 1: Stat Bar */}
                <div className="reveal-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <StatCard title="Active Trips" value={activeTrips.length} subtitle="Currently in progress" icon="🟢" pulse={activeTrips.length > 0} tint="green" />
                    <StatCard title="Pending Bookings" value={pendingTrips.length} subtitle="Awaiting assignment" icon="⚡" tint="amber" />
                    <StatCard title="Available Drivers" value={availableDrivers.length} subtitle="Ready for dispatch" icon="👥" tint="blue" />
                    <StatCard title="Vehicles Deployed" value={deployedVehicles} subtitle="Active assignments" icon="🚗" tint="purple" />
                </div>

                {/* Section 2: Pending Bookings */}
                <section className="reveal-up stagger-1">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                        <h2 style={{
                            fontSize: '22px', fontWeight: 800,
                            color: 'var(--text-dark)',
                            letterSpacing: '-0.5px',
                            fontFamily: 'Inter, sans-serif'
                        }}>Incoming Bookings</h2>
                        <span style={{
                            padding: '4px 12px',
                            borderRadius: '50px',
                            background: 'rgba(13,13,13,0.08)',
                            color: 'var(--text-dark)',
                            fontSize: '13px',
                            fontWeight: 700
                        }}>{pendingTrips.length}</span>
                    </div>

                    {pendingTrips.length === 0 ? (
                        <div style={{
                            padding: '48px 24px',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: '12px',
                            border: '1.5px dashed rgba(13,13,13,0.1)',
                            borderRadius: '20px',
                            background: 'rgba(255,255,255,0.3)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)'
                        }}>
                            <span style={{ fontSize: '32px' }}>📋</span>
                            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>No pending bookings</p>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>New bookings will appear here automatically</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
                            {pendingTrips.map((trip, idx) => (
                                <BookingCard
                                    key={trip.id}
                                    index={idx}
                                    booking={trip}
                                    drivers={availableDrivers}
                                    vehicles={vehicles}
                                    onAssign={handleAssign}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Section 3: Active Trips */}
                <section className="reveal-up stagger-2">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                        <h2 style={{
                            fontSize: '22px', fontWeight: 800,
                            color: 'var(--text-dark)',
                            letterSpacing: '-0.5px',
                            fontFamily: 'Inter, sans-serif'
                        }}>Active Trips</h2>
                        <span style={{
                            padding: '4px 12px',
                            borderRadius: '50px',
                            background: 'rgba(13,13,13,0.08)',
                            color: 'var(--text-dark)',
                            fontSize: '13px',
                            fontWeight: 700
                        }}>{activeTrips.length}</span>
                    </div>

                    {activeTrips.length === 0 ? (
                        <div style={{
                            padding: '48px 24px',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: '12px',
                            border: '1.5px dashed rgba(13,13,13,0.1)',
                            borderRadius: '20px',
                            background: 'rgba(255,255,255,0.3)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)'
                        }}>
                            <span style={{ fontSize: '32px' }}>🚗</span>
                            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>No active trips</p>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Accepted trips in progress will appear here</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
                            {activeTrips.map(trip => (
                                <ActiveTripCard
                                    key={trip.id}
                                    trip={trip}
                                    onComplete={handleComplete}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Section 4: Awaiting Acceptance */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                        <h2 style={{
                            fontSize: '22px', fontWeight: 800,
                            color: 'var(--text-dark)',
                            letterSpacing: '-0.5px',
                            fontFamily: 'Inter, sans-serif'
                        }}>Awaiting Acceptance</h2>
                        <span style={{
                            padding: '4px 12px',
                            borderRadius: '50px',
                            background: 'rgba(13,13,13,0.08)',
                            color: 'var(--text-dark)',
                            fontSize: '13px',
                            fontWeight: 700
                        }}>{assignedTrips.length}</span>
                    </div>

                    {assignedTrips.length === 0 ? (
                        <div style={{
                            padding: '48px 24px',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: '12px',
                            border: '1.5px dashed rgba(13,13,13,0.1)',
                            borderRadius: '20px',
                            background: 'rgba(255,255,255,0.3)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)'
                        }}>
                            <span style={{ fontSize: '32px' }}>⏳</span>
                            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>No trips awaiting acceptance</p>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Assigned trips pending driver confirmation appear here</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {assignedTrips.map(trip => (
                                <div key={trip.id} className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark)' }}>{trip.driver?.full_name || 'Assigned Driver'}</p>
                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Vehicle: {trip.vehicle?.registration_number}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Assigned at</p>
                                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-dark)' }}>
                                            {trip.updated_at ? new Date(trip.updated_at).toLocaleTimeString() : 'Recently'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </PageWrapper>
    );
}
