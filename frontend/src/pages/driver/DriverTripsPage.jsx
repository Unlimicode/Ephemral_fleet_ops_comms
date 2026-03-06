import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios.js';
import { useToast } from '../../components/Toast.jsx';
import DriverTripCard from '../../components/DriverTripCard.jsx';

export default function DriverTripsPage() {
    const [trips, setTrips] = useState([]);
    const [activeTab, setActiveTab] = useState('upcoming'); // upcoming, active, completed
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    const fetchTrips = useCallback(async () => {
        try {
            const res = await api.get('/driver/trips');
            setTrips(res.data.trips || []);
        } catch (err) {
            console.error('Failed to fetch driver trips', err);
            // Non-blocking failure, rely on polling
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrips();
        const interval = setInterval(fetchTrips, 20000);
        return () => clearInterval(interval);
    }, [fetchTrips]);

    const handleAccept = async (tripId) => {
        try {
            await api.patch(`/driver/trips/${tripId}/accept`, { response: 'accepted' });
            showToast('Trip accepted successfully.', 'success');
            fetchTrips();
        } catch {
            showToast('Failed to accept trip.', 'error');
        }
    };

    const handleDecline = async (tripId, reason) => {
        try {
            await api.patch(`/driver/trips/${tripId}/accept`, { response: 'rejected', reason });
            showToast('Trip declined and returned to dispatch.', 'success');
            fetchTrips();
        } catch {
            showToast('Failed to decline trip.', 'error');
        }
    };

    const upcomingTrips = trips.filter(t => t.status === 'assigned');
    const activeTripsList = trips.filter(t => t.status === 'in_progress');
    const completedTrips = trips.filter(t => t.status === 'completed');

    let displayedTrips = [];
    let emptyState = {};

    if (activeTab === 'upcoming') {
        displayedTrips = upcomingTrips;
        emptyState = { icon: '📋', title: 'No upcoming trips', subtitle: 'New assignments will appear here' };
    } else if (activeTab === 'active') {
        displayedTrips = activeTripsList;
        emptyState = { icon: '⚡', title: 'No active trips', subtitle: 'Accept an assignment to start a trip' };
    } else {
        displayedTrips = completedTrips;
        emptyState = { icon: '✅', title: 'No completed trips', subtitle: 'Your trip history will appear here' };
    }

    return (
        <div style={{ padding: '20px' }}>
            <h1 style={{
                fontSize: '24px', fontWeight: 800, color: 'var(--text-dark)',
                fontFamily: 'Inter, sans-serif', marginBottom: '20px', letterSpacing: '-0.5px'
            }}>
                My Trips
            </h1>

            {/* Tab Switcher */}
            <div style={{
                display: 'flex', gap: '8px', marginBottom: '24px',
                background: 'rgba(255,255,255,0.4)', padding: '6px',
                borderRadius: '50px', backdropFilter: 'blur(10px)'
            }}>
                {['upcoming', 'active', 'completed'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1, padding: '8px 20px', borderRadius: '50px',
                            fontSize: '13px', fontWeight: 700, textTransform: 'capitalize',
                            transition: 'all 0.2s', cursor: 'pointer', border: 'none',
                            background: activeTab === tab ? '#0D0D0D' : 'transparent',
                            color: activeTab === tab ? '#FFF' : 'var(--text-dark)'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Trip List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : displayedTrips.length === 0 ? (
                <div style={{
                    padding: '48px 24px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '12px',
                    border: '1.5px dashed rgba(13,13,13,0.1)', borderRadius: '20px',
                    background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(20px)'
                }}>
                    <span style={{ fontSize: '32px' }}>{emptyState.icon}</span>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>{emptyState.title}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>{emptyState.subtitle}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {displayedTrips.map((trip, idx) => (
                        <DriverTripCard
                            key={trip.id}
                            trip={trip}
                            index={idx}
                            onAccept={handleAccept}
                            onDecline={handleDecline}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
