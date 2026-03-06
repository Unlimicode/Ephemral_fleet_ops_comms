import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_LINKS = [
    { to: '/manager/dispatch', label: 'Dispatch', icon: '⚡' },
    { to: '/manager/drivers', label: 'Drivers', icon: '👥' },
    { to: '/manager/vehicles', label: 'Vehicles', icon: '🚗' },
    { to: '/manager/complaints', label: 'Complaints', icon: '⚠️' },
    { to: '/manager/dashboard', label: 'Dashboard', icon: '🔒' },
    { to: '/manager/audit', label: 'Audit', icon: '📋' },
];

export default function ManagerLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    async function handleLogout() {
        await logout();
        navigate('/login', { replace: true });
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>

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
                <div className="glass-blob">
                    <div style={{
                        position: 'absolute', top: '30%', right: '-5%', width: '350px', height: '350px',
                        borderRadius: '50%', background: 'radial-gradient(circle, rgba(230,150,100,0.6) 0%, transparent 70%)',
                        filter: 'blur(20px)', mixBlendMode: 'multiply',
                        animation: 'blobFloat2 16s ease-in-out infinite reverse, blobPulse 8s ease-in-out infinite, glassShimmer 7s ease-in-out infinite 0.5s'
                    }} />
                </div>
            </div>

            {/* Left Sidebar */}
            <aside style={{
                position: 'fixed',
                left: 0, top: 0, bottom: 0,
                width: '240px',
                background: 'rgba(255,255,255,0.45)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                zIndex: 10,
                display: 'flex', flexDirection: 'column',
                borderRight: '1px solid rgba(255,255,255,0.3)'
            }}>
                {/* Logo Lockup */}
                <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <img src="/swiftlink-icon.png" alt="S" style={{ height: '36px', width: '36px', objectFit: 'contain' }} />
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0D0D0D', letterSpacing: '-0.5px', fontFamily: 'Inter, sans-serif' }}>
                        wiftlink
                    </span>
                </div>

                {/* Vertical Navigation Links */}
                <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {NAV_LINKS.map(({ to, label, icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 16px',
                                textDecoration: 'none',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '15px',
                                transition: 'all 0.2s ease',
                                color: isActive ? '#0D0D0D' : 'var(--text-secondary)',
                                background: isActive ? 'rgba(13,13,13,0.08)' : 'transparent',
                                borderRadius: isActive ? '12px' : '0',
                                fontWeight: isActive ? 700 : 500,
                                borderLeft: isActive ? '3px solid #0D0D0D' : '3px solid transparent'
                            })}
                            onMouseEnter={e => {
                                if (e.currentTarget.style.backgroundColor === 'transparent' || e.currentTarget.style.backgroundColor === '') {
                                    e.currentTarget.style.background = 'rgba(13,13,13,0.05)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (e.currentTarget.style.fontWeight !== '700') {
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            <span style={{ fontSize: '18px' }}>{icon}</span>
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* User & Logout */}
                <div style={{ padding: '24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '4px' }}>
                        {user?.full_name || user?.name || 'Manager'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', wordBreak: 'break-all' }}>
                        {user?.corporate_email || user?.email || 'manager@company.com'}
                    </p>
                    <button onClick={handleLogout} className="glass-button" style={{
                        width: '100%', padding: '10px', borderRadius: '10px',
                        color: '#F5EDE3', fontSize: '13px', fontWeight: 600,
                        cursor: 'pointer'
                    }}>
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main style={{ marginLeft: '240px', minHeight: '100vh', position: 'relative', zIndex: 1, padding: '32px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>
                        Fleet Operations
                    </h1>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.4)', padding: '6px 16px', borderRadius: '50px', backdropFilter: 'blur(10px)' }}>
                        {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {currentTime.toLocaleTimeString()}
                    </div>
                </header>
                {children || <Outlet />}
            </main>
        </div>
    );
}
