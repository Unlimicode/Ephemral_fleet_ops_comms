import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios.js';
import { useToast } from '../../components/Toast.jsx';
import DriverTripCard from '../../components/DriverTripCard.jsx';

export default function DriverTripsPage({ defaultTab }) {
    const [trips, setTrips] = useState([]);
    const [activeTab, setActiveTab] = useState(defaultTab || 'upcoming'); // upcoming, active, completed
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        }
    }, [defaultTab]);

    const fetchTrips = useCallback(async () => {
        try {
            const res = await api.get('/driver/trips');
            setTrips(res.data || []);
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
            addToast('Trip accepted successfully.', 'success');
            fetchTrips();
        } catch {
            addToast('Failed to accept trip.', 'error');
        }
    };

    const handleDecline = async (tripId, reason) => {
        try {
            await api.patch(`/driver/trips/${tripId}/accept`, { response: 'rejected', reason });
            addToast('Trip declined and returned to dispatch.', 'success');
            fetchTrips();
        } catch {
            addToast('Failed to decline trip.', 'error');
        }
    };

    const upcomingTrips = trips.filter(t => t.status === 'accepted');
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
        <div className="reveal-up" style={{ padding: '20px' }}>
            <h1 className="kinetic-text" style={{ fontSize: '28px', marginBottom: '24px' }}>
                My Trips
            </h1>

            {/* Tab Switcher */}
            <div className="reveal-up stagger-1" style={{
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
                <>
                    <style>{`@keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }`}</style>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[0, 1, 2].map(i => {
                            const sh = { background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 100%)', backgroundSize: '200% 100%', animation: `shimmer 1.5s ${i * 0.15}s infinite linear`, borderRadius: '12px' };
                            return (
                                <div key={i} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ ...sh, width: '80px', height: '20px' }} />
                                    <div style={{ ...sh, width: '100%', height: '24px' }} />
                                    <div style={{ ...sh, width: '60%', height: '16px' }} />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ ...sh, width: '100px', height: '36px' }} />
                                        <div style={{ ...sh, width: '100px', height: '36px' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : displayedTrips.length === 0 ? (
                <div className="reveal-up stagger-2" style={{
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {displayedTrips.map((trip, idx) => (
                        <div
                            key={trip.id}
                            className={`reveal-up stagger-${Math.min(idx + 2, 4)}`}
                            onClick={activeTab === 'active' ? () => navigate(`/driver/trips/${trip.id}`) : undefined}
                            style={activeTab === 'active' ? { cursor: 'pointer' } : undefined}
                        >
                            <DriverTripCard
                                trip={trip}
                                index={idx}
                                onAccept={handleAccept}
                                onDecline={handleDecline}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
