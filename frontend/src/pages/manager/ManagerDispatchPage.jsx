import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatCard from '../../components/StatCard.jsx';
import BookingCard from '../../components/BookingCard.jsx';
import ActiveTripCard from '../../components/ActiveTripCard.jsx';

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
            setTrips(tripsRes.data.trips || []);
            setDrivers(driversRes.data.drivers || []);
            setVehicles(vehiclesRes.data.vehicles || []);
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

        const socket = io(`${import.meta.env.VITE_API_URL}/dashboard`, {
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
            await api.patch(`/trips/${tripId}/complete`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to complete trip.');
        }
    };

    if (loading) {
        return (
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
        );
    }

    if (error) {
        return (
            <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--accent-warning)', maxWidth: '400px', margin: '40px auto' }}>
                {error}
            </div>
        );
    }

    const pendingTrips = trips.filter(t => t.status === 'pending');
    const assignedTrips = trips.filter(t => t.status === 'accepted');
    const activeTrips = trips.filter(t => t.status === 'in_progress');

    const availableDrivers = drivers.filter(d => d.availability_status === 'available');
    const deployedVehicles = activeTrips.length; // Approximate vehicles deployed based on active trips

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Section 1: Stat Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                <StatCard title="Active Trips" value={activeTrips.length} subtitle="Currently in progress" icon="🟢" pulse={activeTrips.length > 0} />
                <StatCard title="Pending Bookings" value={pendingTrips.length} subtitle="Awaiting assignment" icon="⚡" />
                <StatCard title="Available Drivers" value={availableDrivers.length} subtitle="Ready for dispatch" icon="👥" />
                <StatCard title="Vehicles Deployed" value={deployedVehicles} subtitle="Active assignments" icon="🚗" />
            </div>

            {/* Section 2: Pending Bookings */}
            <section>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    Incoming Bookings
                    <span style={{ background: 'var(--accent-gradient)', color: '#fff', fontSize: '12px', padding: '2px 10px', borderRadius: '50px' }}>
                        {pendingTrips.length}
                    </span>
                </h2>

                {pendingTrips.length === 0 ? (
                    <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No pending bookings
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
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
            <section>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    Active Trips
                    <span style={{ background: 'var(--accent-gradient)', color: '#fff', fontSize: '12px', padding: '2px 10px', borderRadius: '50px' }}>
                        {activeTrips.length}
                    </span>
                </h2>

                {activeTrips.length === 0 ? (
                    <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No active trips
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
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
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    Awaiting Acceptance
                    <span style={{ background: 'var(--accent-gradient)', color: '#fff', fontSize: '12px', padding: '2px 10px', borderRadius: '50px' }}>
                        {assignedTrips.length}
                    </span>
                </h2>

                {assignedTrips.length === 0 ? (
                    <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No trips awaiting driver acceptance
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
    );
}
