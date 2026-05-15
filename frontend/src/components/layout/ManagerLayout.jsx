import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import SwiftlinkLogo from '../SwiftlinkLogo.jsx';

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
    const { user, logout, token } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const width = useWindowWidth();
    const [complaintCount, setComplaintCount] = useState(0);
    const [enquiryCount, setEnquiryCount] = useState(0);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const socketRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const isDesktop = width >= 1024;
    const isTablet = width >= 768 && width < 1024;
    const isMobile = width < 768;

    const fetchCounts = useCallback(async () => {
        try {
            const [compRes, enqRes] = await Promise.all([
                api.get('/complaints'),
                api.get('/contact'),
            ]);
            const open = compRes.data.filter(c => c.status === 'open').length;
            setComplaintCount(open);
            const newEnq = enqRes.data.filter(e => e.status === 'new').length;
            setEnquiryCount(newEnq);
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

    useEffect(() => {
        if (!token) return;
        const socket = io(import.meta.env.VITE_WS_URL + '/dashboard', { auth: { token } });
        socketRef.current = socket;

        socket.on('complaint_filed', () => {
            setComplaintCount(prev => prev + 1);
        });

        socket.on('new_enquiry', () => {
            setEnquiryCount(prev => prev + 1);
        });

        socket.on('complaint_status_updated', ({ new_status }) => {
            if (new_status === 'resolved') {
                setComplaintCount(prev => Math.max(0, prev - 1));
            }
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [token]);

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
                className={({ isActive }) => `flex items-center gap-2 text-sm font-bold relative${!isActive ? (vertical ? ' hover:bg-white/10' : ' hover:bg-[rgba(0,0,0,0.06)]') : ''}`}
                style={({ isActive }) => isActive ? {
                    background: '#2D2D2D',
                    color: '#F5EDE3',
                    borderRadius: '9999px',
                    padding: '8px 18px',
                    transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                    textDecoration: 'none',
                } : {
                    color: vertical ? '#F5EDE3' : '#6B6B6B',
                    padding: '8px 18px',
                    borderRadius: '9999px',
                    transition: 'all 0.3s ease',
                    textDecoration: 'none',
                }}
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
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflowX: 'hidden' }}>
            {/* Background */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <div className="arch-grid" style={{ position: 'absolute', inset: 0, opacity: 0.35 }} />
                <div className="animate-float-slow" style={{
                    position: 'absolute', top: '-20%', right: '-10%',
                    width: 700, height: 700, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(108,99,255,0.10), transparent 70%)'
                }} />
                <div className="animate-float-reverse" style={{
                    position: 'absolute', bottom: '-20%', left: '-10%',
                    width: 600, height: 600, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,212,255,0.07), transparent 70%)'
                }} />
                <div className="geo-shape animate-float-slow" style={{ top: '15%', left: '5%', color: 'rgba(13,13,13,0.025)' }}>
                    <div className="geo-triangle" style={{ transform: 'scale(2) rotate(15deg)' }} />
                </div>
                <div className="geo-shape animate-float-reverse" style={{ bottom: '10%', right: '8%', color: 'rgba(108,99,255,0.04)' }}>
                    <div className="geo-triangle" style={{ transform: 'scale(1.5) rotate(-10deg)' }} />
                </div>
            </div>

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
                        <SwiftlinkLogo height={36} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="font-bold text-sm">{user?.name?.split(' ')[0] || 'Manager'}</span>
                        <NavLink to="/manager/help" title="Help Guide" className="help-pill">
                            ? Help
                        </NavLink>
                    </div>
                </header>
            ) : (
                /* Desktop/Tablet Pill Nav */
                <nav style={{
                    position: 'sticky', top: '24px', zIndex: 50,
                    maxWidth: '1440px', margin: '16px auto', padding: '0 16px'
                }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.25)',
                        backdropFilter: 'blur(40px)',
                        WebkitBackdropFilter: 'blur(40px)',
                        border: '1px solid rgba(255,255,255,0.5)',
                        borderRadius: '9999px',
                        padding: '10px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
                    }}>
                        {/* Logo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <SwiftlinkLogo height={32} />
                            <span style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 900, fontSize: '17px', letterSpacing: '-0.03em', color: '#0D0D0D' }}>SwiftLink</span>
                        </div>

                        {/* Middle Links (Desktop Only) */}
                        {isDesktop && (
                            <div style={{ position: 'relative', display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.04)', borderRadius: '9999px', padding: '4px' }}>
                                {renderNavLinks()}
                            </div>
                        )}

                        {/* Right Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {/* Clock pill — desktop only */}
                            {isDesktop && (
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#6B6B6B', background: 'rgba(0,0,0,0.04)', borderRadius: '9999px', padding: '6px 14px', letterSpacing: '0.02em' }}>
                                    {currentTime.toLocaleTimeString()} · {currentTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </div>
                            )}
                            {/* Divider */}
                            {isDesktop && <div style={{ width: '1px', height: '24px', background: 'rgba(0,0,0,0.1)' }} />}
                            {/* Notification Bell */}
                            <div
                                className="relative cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                                onClick={() => navigate('/manager/complaints')}
                                title={complaintCount > 0 ? `${complaintCount} open complaints` : 'Complaints'}
                            >
                                🔔
                                {complaintCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#EF4444] rounded-full" />}
                            </div>

                            {/* Help button */}
                            <NavLink to="/manager/help" title="Help Guide" className="help-pill">
                                ? Help
                            </NavLink>

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
                            <NavLink to="/manager/help" onClick={() => setDrawerOpen(false)} className="help-pill help-pill-dark">
                                ? Help
                            </NavLink>
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

            {/* Floating Messages pill — sits clearly below the nav bar, above page content */}
            {location.pathname !== '/manager/messages' && (
                <button
                    type="button"
                    onClick={() => navigate('/manager/messages')}
                    title="Messages"
                    className="floating-messages-pill"
                    style={{
                        position: 'fixed',
                        top: isMobile ? '72px' : '112px',
                        right: isMobile ? '16px' : '40px',
                        zIndex: 60,
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: isMobile ? '10px 18px' : '14px 24px',
                        borderRadius: '9999px',
                        background: 'rgba(255,255,255,0.7)',
                        backdropFilter: 'blur(40px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                        border: '1px solid rgba(255,255,255,0.85)',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95)',
                        color: '#0D0D0D',
                        fontSize: isMobile ? '13px' : '14px', fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: "'Be Vietnam Pro', sans-serif",
                        letterSpacing: '-0.01em',
                        pointerEvents: 'auto',
                        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                    }}
                >
                    <span style={{ fontSize: isMobile ? '16px' : '18px' }}>💬</span>
                    <span>Messages</span>
                    {enquiryCount > 0 && (
                        <span style={{
                            background: '#6C63FF', color: '#fff',
                            borderRadius: '9999px',
                            minWidth: '22px', height: '22px',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 800,
                            padding: '0 7px', marginLeft: '2px',
                        }}>{enquiryCount}</span>
                    )}
                </button>
            )}

            {/* Content Area */}
            <main style={{
                maxWidth: isMobile ? '100%' : '1440px',
                margin: '0 auto',
                padding: isMobile ? '16px' : isTablet ? '16px 24px' : '20px 32px',
                paddingBottom: isMobile ? '80px' : '32px',
                position: 'relative',
                zIndex: 1
            }}>
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
