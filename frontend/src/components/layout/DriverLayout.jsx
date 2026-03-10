import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../api/axios.js';
import GeoBackground from '../GeoBackground.jsx';

const TABS = [
    { to: '/driver/trips', label: 'Trips', icon: '🗂️' },
    { to: '/driver/trips/active', label: 'Active', icon: '⚡' },
    { to: '/driver/notifications', label: 'Notifications', icon: '🔔' },
    { to: '/driver/profile', label: 'Profile', icon: '👤' },
];

export default function DriverLayout() {
    const { user } = useAuth();
    const [activeTripId, setActiveTripId] = useState(null);

    useEffect(() => {
        const checkActiveTrips = async () => {
            try {
                const res = await api.get('/driver/trips');
                const triplist = res.data || [];
                const active = triplist.find(t => t.status === 'in_progress');
                setActiveTripId(active ? active.id : null);
            } catch (err) {
                console.error('Failed to check active trips for indicator', err);
            }
        };

        checkActiveTrips();
        const interval = setInterval(checkActiveTrips, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-base)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <GeoBackground density="normal" fixed={true} />
            {/* Removed inline blob background */}

            {/* Top Bar */}
            <header style={{
                position: 'fixed',
                top: 0, left: 0, right: 0,
                height: '64px',
                padding: '0 20px',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                borderBottom: '0.5px solid var(--glass-border)',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--bg-dark)', color: 'var(--text-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontStyle: 'italic', fontSize: '1rem' }}>S</div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.05em', fontFamily: 'Inter, sans-serif' }}>
                        swiftlink
                    </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {user?.full_name?.split(' ')[0] || user?.name || 'Driver'}
                </div>
            </header>

            {/* Content Area */}
            <main style={{
                paddingTop: '64px',
                paddingBottom: '80px',
                flex: 1,
                position: 'relative',
                zIndex: 1,
            }}>
                <Outlet />
            </main>

            {/* Bottom Tab Bar */}
            <nav style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0,
                height: '72px',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                borderTop: '0.5px solid var(--glass-border)',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                padding: '0 10px'
            }}>
                {TABS.map(({ to, label, icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        style={({ isActive }) => ({
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            transition: 'all 0.2s ease',
                            color: isActive ? 'var(--accent-primary)' : 'rgba(13,13,13,0.35)',
                            position: 'relative',
                            flex: 1,
                            minWidth: 0,
                            padding: '4px'
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                <span style={{ fontSize: '24px', marginBottom: '2px', filter: isActive ? 'none' : 'grayscale(1) opacity(0.6)' }}>
                                    {icon}
                                    {label === 'Active' && activeTripId && (
                                        <div className="session-pulse" style={{
                                            position: 'absolute',
                                            top: '2px', right: '2px',
                                            width: '8px', height: '8px',
                                            borderRadius: '50%',
                                            background: 'var(--accent-success)',
                                            boxShadow: '0 0 8px var(--accent-success)'
                                        }} />
                                    )}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: isActive ? 700 : 500, fontFamily: 'Inter, sans-serif' }}>
                                    {label}
                                </span>
                                {isActive && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        width: '6px', height: '6px',
                                        borderRadius: '50%',
                                        background: 'var(--accent-primary)'
                                    }} />
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}
