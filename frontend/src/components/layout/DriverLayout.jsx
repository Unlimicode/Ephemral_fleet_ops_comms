import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import SwiftlinkLogo from '../SwiftlinkLogo.jsx';

// Activates all .reveal-up elements in the driver content area on every route
// change. SwiftlinkHomePage has its own IntersectionObserver; driver pages do
// not — without this, every glass card and section starts at opacity:0 and
// never becomes visible.
function useRevealUp(pathname) {
    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            document.querySelectorAll('.reveal-up').forEach(el => el.classList.add('active'));
        });
        return () => cancelAnimationFrame(raf);
    }, [pathname]);
}

const TABS = [
    { to: '/driver/trips', label: 'Trips', icon: '🗂️' },
    { to: '/driver/notifications', label: 'Notifications', icon: '🔔' },
    { to: '/driver/profile', label: 'Profile', icon: '👤' },
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

export default function DriverLayout() {
    const { user } = useAuth();
    const location = useLocation();
    const width = useWindowWidth();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const isDesktop = width >= 1024;
    const isTablet = width >= 768 && width < 1024;
    const isMobile = width < 768;

    useRevealUp(location.pathname);

    const renderNavLinks = (vertical = false) => (
        TABS.map(tab => (
            <NavLink
                key={tab.to}
                to={tab.to}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => `
                    flex items-center gap-3 px-5 py-2 rounded-full transition-all text-sm font-bold relative
                    ${isActive
                        ? 'bg-[#0D0D0D] text-[#F5EDE3]'
                        : vertical ? 'text-[#F5EDE3] hover:bg-white/10' : 'text-[#6B6B6B] hover:bg-white/40'}
                `}
            >
                {tab.label}
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
                    background: 'radial-gradient(circle, rgba(108,99,255,0.09), transparent 70%)'
                }} />
                <div className="animate-float-reverse" style={{
                    position: 'absolute', bottom: '-20%', left: '-10%',
                    width: 600, height: 600, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,245,160,0.06), transparent 70%)'
                }} />
                <div className="geo-shape animate-float-slow" style={{ top: '15%', left: '5%', color: 'rgba(13,13,13,0.025)' }}>
                    <div className="geo-triangle" style={{ transform: 'scale(2) rotate(15deg)' }} />
                </div>
                <div className="geo-shape animate-float-reverse" style={{ bottom: '10%', right: '8%', color: 'rgba(0,245,160,0.04)' }}>
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
                    <span className="font-bold text-sm">{user?.name?.split(' ')[0] || 'Driver'}</span>
                </header>
            ) : (
                /* Desktop/Tablet Pill Nav */
                <nav style={{
                    position: 'sticky', top: '16px', zIndex: 50,
                    maxWidth: '1200px', margin: '16px auto', padding: '0 16px'
                }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(40px)',
                        border: '1px solid rgba(255,255,255,0.5)', borderRadius: '9999px',
                        padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div className="flex items-center gap-3">
                            <SwiftlinkLogo height={36} />
                        </div>

                        {isDesktop && <div className="flex gap-2">{renderNavLinks()}</div>}

                        <div className="flex items-center gap-4">
                            {isTablet && (
                                <button
                                    onClick={() => setDrawerOpen(true)}
                                    className="bg-[#0D0D0D] text-white w-9 h-9 rounded-full flex items-center justify-center"
                                >
                                    ☰
                                </button>
                            )}
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase font-black tracking-widest text-[#6B6B6B]">
                                    {user?.name || 'Driver'}
                                </span>
                                <span className="text-[10px] uppercase font-bold text-[#00A86B]">Active Duty</span>
                            </div>
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
                        <button onClick={() => setDrawerOpen(false)} className="absolute top-6 right-6 text-white text-2xl">×</button>
                        <div className="mt-12 flex flex-col gap-2">
                            {renderNavLinks(true)}
                        </div>
                    </div>
                </>
            )}

            {/* Content Area */}
            <main style={{
                maxWidth: isMobile ? '100%' : '1200px',
                margin: '0 auto',
                padding: isMobile ? '0' : isTablet ? '20px 24px' : '24px 32px',
                paddingBottom: isMobile ? '80px' : '32px',
                position: 'relative',
                zIndex: 1,
                boxSizing: 'border-box',
                overflowX: 'hidden',
                width: '100%'
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
                    {TABS.map(tab => {
                        const isActive = location.pathname === tab.to;
                        return (
                            <NavLink
                                key={tab.to}
                                to={tab.to}
                                className="flex flex-col items-center gap-1 min-w-[60px] relative"
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
                            </NavLink>
                        );
                    })}
                </nav>
            )}
        </div>
    );
}