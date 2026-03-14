import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_LINKS = [
    { to: '/manager/dashboard', label: 'Dashboard', icon: '🔒' },
    { to: '/manager/dispatch', label: 'Dispatch', icon: '⚡' },
    { to: '/manager/drivers', label: 'Drivers', icon: '👥' },
    { to: '/manager/vehicles', label: 'Vehicles', icon: '🚗' },
    { to: '/manager/complaints', label: 'Complaints', icon: '⚠️' },
    { to: '/manager/audit', label: 'Audit', icon: '📋' },
];

function useWindowWidth() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return width;
}

export default function ManagerLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const width = useWindowWidth();
    const [complaintCount, setComplaintCount] = useState(0);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    const isDesktop = width >= 1024;
    const isTablet = width >= 768 && width < 1024;
    const isMobile = width < 768;

    const fetchCounts = useCallback(async () => {
        try {
            const res = await api.get('/complaints');
            const open = res.data.filter(c => c.status === 'open').length;
            setComplaintCount(open);
        } catch (err) {
            console.error('Failed to fetch counts:', err);
        }
    }, []);

    useEffect(() => {
        Promise.resolve().then(() => fetchCounts());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        const countTimer = setInterval(fetchCounts, 60000);
        return () => {
            clearInterval(timer);
            clearInterval(countTimer);
        };
    }, [fetchCounts]);

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    const renderNavLinks = (vertical = false) => (
        NAV_LINKS.map(link => (
            <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => `
                    flex items-center gap-3 px-5 py-2 rounded-full transition-all text-sm font-bold relative
                    ${isActive
                        ? 'bg-[#0D0D0D] text-[#F5EDE3]'
                        : vertical ? 'text-[#F5EDE3] hover:bg-white/10' : 'text-[#6B6B6B] hover:bg-white/40'}
                `}
            >
                {link.label}
                {link.label === 'Complaints' && complaintCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[10px] text-white">
                        {complaintCount}
                    </span>
                )}
            </NavLink>
        ))
    );

    return (
        <div style={{ minHeight: '100vh', background: '#F5EDE3', position: 'relative', overflowX: 'hidden' }}>
            {/* Background Layer: Blobs */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                <div style={{
                    position: 'absolute', bottom: '-15%', left: '-10%', width: 'min(650px, 80vw)', height: 'min(650px, 80vw)',
                    borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,180,140,0.6) 0%, transparent 70%)',
                    filter: 'blur(40px)', mixBlendMode: 'multiply',
                    animation: 'blobFloat1 14s ease-in-out infinite'
                }} />
                <div style={{
                    position: 'absolute', top: '-10%', left: '30%', width: 'min(400px, 60vw)', height: 'min(400px, 60vw)',
                    borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,200,170,0.5) 0%, transparent 70%)',
                    filter: 'blur(45px)', mixBlendMode: 'multiply',
                    animation: 'blobFloat2 18s ease-in-out infinite'
                }} />
                <div style={{
                    position: 'absolute', top: '10%', right: '5%', width: 'min(300px, 50vw)', height: 'min(300px, 50vw)',
                    borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.4) 0%, transparent 70%)',
                    filter: 'blur(50px)', mixBlendMode: 'multiply',
                    animation: 'blobFloat3 22s ease-in-out infinite'
                }} />
            </div>

            {/* arch-grid overlay */}
            <div className="arch-grid" />

            {/* ─── Navigation ─── */}
            {isMobile ? (
                /* Mobile Top Bar */
                <header style={{
                    position: 'sticky', top: 0, width: '100%', height: '56px',
                    background: 'rgba(245,237,227,0.85)', backdropFilter: 'blur(40px)',
                    borderBottom: '1px solid rgba(255,255,255,0.6)', zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px'
                }}>
                    <div className="flex items-center gap-2">
                        <div className="bg-[#0D0D0D] w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black">S</div>
                        <span className="font-extrabold tracking-tighter text-sm">Fleet Ops</span>
                    </div>
                    <span className="font-bold text-sm">{user?.name?.split(' ')[0] || 'Manager'}</span>
                </header>
            ) : (
                /* Desktop/Tablet Pill Nav */
                <nav style={{
                    position: 'sticky', top: '16px', zIndex: 50,
                    maxWidth: '1440px', margin: '16px auto', padding: '0 16px'
                }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(40px)',
                        border: '1px solid rgba(255,255,255,0.5)', borderRadius: '9999px',
                        padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="bg-[#0D0D0D] w-9 h-9 rounded-xl flex items-center justify-center text-white font-black">S</div>
                            <span className="font-extrabold tracking-tighter text-lg">Fleet Ops</span>
                        </div>

                        {/* Middle Links (Desktop Only) */}
                        {isDesktop && <div className="flex gap-2">{renderNavLinks()}</div>}

                        {/* Right Actions */}
                        <div className="flex items-center gap-4">
                            {/* Notification Bell */}
                            <div className="relative cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                                🔔
                                {complaintCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#EF4444] rounded-full" />}
                            </div>

                            {isTablet && (
                                <button
                                    onClick={() => setDrawerOpen(true)}
                                    className="bg-[#0D0D0D] text-white w-9 h-9 rounded-full flex items-center justify-center"
                                >
                                    ☰
                                </button>
                            )}

                            {isDesktop && (
                                <>
                                    <div className="h-8 w-px bg-[#0D0D0D]/10" />
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] uppercase font-black tracking-widest text-[#6B6B6B]">
                                            {user?.name || 'Manager'}
                                        </span>
                                        <span className="text-[10px] uppercase font-bold text-[#6B6B6B]/60">Ops Centre</span>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="bg-[#0D0D0D] text-[#F5EDE3] px-4 py-2 rounded-full text-xs font-bold transition-transform hover:-translate-y-0.5"
                                    >
                                        Logout
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </nav>
            )}

            {/* Tablet Drawer */}
            {isTablet && (
                <>
                    <div
                        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        onClick={() => setDrawerOpen(false)}
                    />
                    <div
                        className={`fixed top-0 left-0 bottom-0 w-[280px] bg-[#0D0D0D] z-[60] transition-transform duration-300 p-8 glass-card-dark rounded-none border-r border-white/10 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
                    >
                        <button
                            onClick={() => setDrawerOpen(false)}
                            className="absolute top-6 right-6 text-white text-2xl"
                        >
                            ×
                        </button>
                        <div className="mt-12 flex flex-col gap-2">
                            {renderNavLinks(true)}
                        </div>
                        <div className="absolute bottom-10 left-8 right-8">
                            <button
                                onClick={handleLogout}
                                className="w-full bg-[#F5EDE3] text-[#0D0D0D] py-3 rounded-xl font-bold"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Content Area */}
            <main style={{
                maxWidth: isMobile ? '100%' : '1440px',
                margin: '0 auto',
                padding: isMobile ? '16px' : isTablet ? '20px 24px' : '24px 32px',
                paddingBottom: isMobile ? '80px' : '32px',
                position: 'relative',
                zIndex: 1
            }}>
                {/* Live Clock (Desktop/Tablet) */}
                {!isMobile && (
                    <div className="flex justify-end mb-6">
                        <div style={{
                            background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(40px)',
                            border: '1px solid rgba(255,255,255,0.5)', borderRadius: '9999px',
                            padding: '6px 16px', fontSize: '12px', fontWeight: 600,
                            fontFamily: 'JetBrains Mono, monospace', color: '#6B6B6B'
                        }}>
                            {currentTime.toLocaleTimeString()} • {currentTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                    </div>
                )}

                <Outlet />
            </main>

            {/* Mobile Bottom Navigation */}
            {isMobile && (
                <nav style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, height: '64px',
                    background: 'rgba(245,237,227,0.85)', backdropFilter: 'blur(40px)',
                    borderTop: '1px solid rgba(255,255,255,0.6)', zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-around'
                }}>
                    {[
                        { to: '/manager/dispatch', label: 'Dispatch', icon: '⚡' },
                        { to: '/manager/drivers', label: 'Drivers', icon: '👥' },
                        { to: '/manager/vehicles', label: 'Vehicles', icon: '🚗' },
                        { to: '/manager/complaints', label: 'Complaints', icon: '⚠️' },
                        { to: '/manager/audit', label: 'Audit', icon: '📋' },
                    ].map(tab => {
                        const isActive = location.pathname === tab.to;
                        return (
                            <NavLink
                                key={tab.to}
                                to={tab.to}
                                className="flex flex-col items-center gap-1 min-w-[60px]"
                                style={{ textDecoration: 'none' }}
                            >
                                <span style={{ fontSize: '20px' }}>{tab.icon}</span>
                                <span style={{
                                    fontSize: '9px', fontWeight: 800, textTransform: 'uppercase',
                                    color: isActive ? '#0D0D0D' : '#6B6B6B'
                                }}>
                                    {tab.label}
                                </span>
                                {isActive && <div className="w-1 h-1 rounded-full bg-[#0D0D0D]" />}
                                {tab.label === 'Complaints' && complaintCount > 0 && (
                                    <div className="absolute top-1 right-2 w-2 h-2 bg-[#EF4444] rounded-full" />
                                )}
                            </NavLink>
                        );
                    })}
                </nav>
            )}
        </div>
    );
}
