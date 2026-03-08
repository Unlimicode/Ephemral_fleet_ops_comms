import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
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
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [complaintCount, setComplaintCount] = useState(0);

    const fetchCounts = async () => {
        try {
            const res = await axios.get('/api/complaints');
            const open = res.data.filter(c => c.status === 'open').length;
            setComplaintCount(open);
        } catch (err) {
            console.error('Failed to fetch counts:', err);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        // Explicitly deferred to avoid cascading synchronous render warnings
        const deferredFetch = async () => await fetchCounts();
        deferredFetch();
        const countTimer = setInterval(fetchCounts, 60000);
        return () => { clearInterval(timer); clearInterval(countTimer); };
    }, []);

    async function handleLogout() {
        await logout();
        navigate('/login', { replace: true });
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
            <style>{`
                .manager-sidebar { width: 240px; transform: translateX(0); transition: transform 0.3s ease; }
                .manager-main { margin-left: 240px; padding: 32px; }
                .mobile-toggle { display: none; }
                .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 15; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); transition: opacity 0.3s; opacity: 0; pointer-events: none; }
                .sidebar-overlay.open { display: block; opacity: 1; pointer-events: auto; }
                @media (max-width: 768px) {
                    .manager-sidebar { transform: translateX(-100%); }
                    .manager-sidebar.open { transform: translateX(0); box-shadow: 4px 0 24px rgba(0,0,0,0.2); }
                    .manager-main { margin-left: 0 !important; padding: 16px !important; }
                    .mobile-toggle { display: block; border: none; background: transparent; font-size: 24px; cursor: pointer; padding: 0; margin-right: 12px; }
                    .manager-header-content { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
                }
            `}</style>

            <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

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
            <aside className={`manager-sidebar ${sidebarOpen ? 'open' : ''}`} style={{
                position: 'fixed',
                left: 0, top: 0, bottom: 0,
                background: 'rgba(255, 255, 255, 0.35)',
                backdropFilter: 'blur(60px) saturate(200%)',
                WebkitBackdropFilter: 'blur(60px) saturate(200%)',
                borderRight: '1px solid rgba(255,255,255,0.7)',
                boxShadow: '4px 0 24px rgba(180,130,80,0.08), inset -1px 0 0 rgba(255,255,255,0.5)',
                display: 'flex', flexDirection: 'column',
                zIndex: 20,
                padding: '28px 16px'
            }}>
                {/* Logo Lockup */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '24px', padding: '0 8px' }}>
                    <img src="/swiftlink-icon.png" alt="S" style={{ height: '40px', width: '40px', objectFit: 'contain' }} />
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0D0D0D', letterSpacing: '-0.5px', fontFamily: 'Inter, sans-serif' }}>
                        wiftlink
                    </span>
                </div>

                {/* Vertical Navigation Links */}
                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {NAV_LINKS.map(({ to, label, icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 16px',
                                borderRadius: '14px',
                                marginBottom: '4px',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                position: 'relative',
                                background: isActive ? 'rgba(13,13,13,0.08)' : 'transparent',
                                color: isActive ? '#0D0D0D' : '#6B6B6B',
                                fontWeight: isActive ? 700 : 500,
                                fontSize: '14px',
                                fontFamily: 'Inter, sans-serif'
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
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div style={{
                                            position: 'absolute',
                                            left: 0, top: '20%', bottom: '20%',
                                            width: '3px',
                                            borderRadius: '0 3px 3px 0',
                                            background: '#0D0D0D'
                                        }} />
                                    )}
                                    <span style={{ fontSize: '18px' }}>{icon}</span>
                                    {label}
                                    {label === 'Complaints' && complaintCount > 0 && (
                                        <span style={{
                                            marginLeft: 'auto',
                                            background: '#EF4444',
                                            color: '#FFF',
                                            fontSize: '10px',
                                            fontWeight: 800,
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            minWidth: '18px',
                                            textAlign: 'center'
                                        }}>
                                            {complaintCount}
                                        </span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User & Logout */}
                <div style={{
                    marginTop: 'auto',
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'rgba(13,13,13,0.04)',
                    border: '1px solid rgba(13,13,13,0.06)'
                }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '4px' }}>
                        {user?.full_name || user?.name || 'Manager'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                        {user?.corporate_email || user?.email || 'manager@company.com'}
                    </p>
                    <button onClick={handleLogout} style={{
                        width: '100%',
                        marginTop: '12px',
                        padding: '11px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(13,13,13,0.85)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        color: '#F5EDE3',
                        fontSize: '13px',
                        fontWeight: 600,
                        fontFamily: 'Inter, sans-serif',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                        transition: 'all 0.25s ease'
                    }}>
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="manager-main" style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
                <header className="manager-header-content" style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '32px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <button className="mobile-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
                        <div>
                            <h1 style={{
                                fontSize: '28px', fontWeight: 800,
                                color: 'var(--text-dark)',
                                letterSpacing: '-1px',
                                fontFamily: 'Inter, sans-serif'
                            }}>Fleet Operations</h1>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Swiftlink Fleet Operations
                            </p>
                        </div>
                    </div>
                    <div style={{
                        padding: '10px 18px',
                        borderRadius: '50px',
                        background: 'rgba(255,255,255,0.5)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.7)',
                        fontSize: '13px', fontWeight: 500,
                        color: 'var(--text-secondary)',
                        boxShadow: '0 2px 8px rgba(180,130,80,0.08)'
                    }}>
                        {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {currentTime.toLocaleTimeString()}
                    </div>
                </header>
                {children || <Outlet />}
            </main>
        </div>
    );
}
