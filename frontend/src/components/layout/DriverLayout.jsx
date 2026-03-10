import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../api/axios.js';

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
            background: 'var(--bg-base)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Blobs (z-index: 0) matching login page */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                <div className="glass-blob">
                    <div style={{
                        position: 'absolute', bottom: '-15%', left: '-10%', width: '650px', height: '650px',
                        borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,180,140,0.75) 0%, rgba(230,160,110,0.75) 40%, transparent 70%)',
                        filter: 'blur(20px)', mixBlendMode: 'multiply',
                        animation: 'blobFloat1 14s ease-in-out infinite, blobPulse 7s ease-in-out infinite, glassShimmer 6s ease-in-out infinite'
                    }} />
                </div>
                <div className="glass-blob">
                    <div style={{
                        position: 'absolute', top: '-10%', left: '30%', width: '400px', height: '400px',
                        borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,200,170,0.65) 0%, transparent 70%)',
                        filter: 'blur(22px)', mixBlendMode: 'multiply',
                        animation: 'blobFloat2 18s ease-in-out infinite, blobPulse 9s ease-in-out infinite, glassShimmer 8s ease-in-out infinite 1s'
                    }} />
                </div>
                <div className="glass-blob">
                    <div style={{
                        position: 'absolute', top: '10%', right: '5%', width: '300px', height: '300px',
                        borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.5) 0%, transparent 70%)',
                        filter: 'blur(25px)', mixBlendMode: 'multiply',
                        animation: 'blobFloat3 22s ease-in-out infinite, blobPulse 11s ease-in-out infinite, glassShimmer 10s ease-in-out infinite 2s'
                    }} />
                </div>
            </div>

            {/* Top Bar */}
            <header style={{
                position: 'fixed',
                top: 0, left: 0, right: 0,
                height: '64px',
                padding: '0 20px',
                background: 'rgba(245,237,227,0.85)',
                backdropFilter: 'blur(40px) saturate(180%)',
                borderBottom: '1px solid rgba(255,255,255,0.6)',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
                    <img src="/swiftlink-icon.png" alt="S" style={{ height: '32px', width: '32px', objectFit: 'contain' }} />
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0D0D0D', letterSpacing: '-0.5px', fontFamily: 'Inter, sans-serif' }}>
                        wiftlink
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
                background: 'rgba(245,237,227,0.85)',
                backdropFilter: 'blur(40px) saturate(180%)',
                borderTop: '1px solid rgba(255,255,255,0.6)',
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
                            color: isActive ? '#0D0D0D' : 'var(--text-muted)',
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
                                        background: '#0D0D0D'
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
