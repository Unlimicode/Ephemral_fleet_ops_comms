import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const TABS = [
    { to: '/driver/trips', label: 'Trips', icon: '🗺️' },
    { to: '/driver/trips/active', label: 'Active', icon: '🚗' },
    { to: '/driver/profile', label: 'Profile', icon: '👤' },
    { to: '/driver/notifications', label: 'Notify', icon: '🔔' },
];

// DriverLayout renders the mobile-optimised driver shell: fixed top bar with
// logo and driver name, full-height content area, and a fixed bottom tab bar
// with active state driven by react-router-dom NavLink.
export default function DriverLayout() {
    const { user } = useAuth();

    return (
        <div
            style={{
                minHeight: '100vh',
                backgroundColor: 'var(--bg-base)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Top bar */}
            <header
                style={{
                    background: 'var(--bg-card-solid)',
                    backdropFilter: 'var(--glass-blur)',
                    WebkitBackdropFilter: 'var(--glass-blur)',
                    borderBottom: 'var(--glass-border)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                }}
            >
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="gradient-text text-lg font-bold">Swiftlink</span>
                    <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {user?.full_name || user?.name || 'Driver'}
                    </span>
                </div>
            </header>

            {/* Scrollable content */}
            <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
                <Outlet />
            </main>

            {/* Bottom tab bar */}
            <nav
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card-solid)',
                    backdropFilter: 'var(--glass-blur)',
                    WebkitBackdropFilter: 'var(--glass-blur)',
                    borderTop: 'var(--glass-border)',
                    zIndex: 50,
                }}
            >
                <div className="flex items-center justify-around py-2">
                    {TABS.map(({ to, label, icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                [
                                    'flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all duration-300',
                                    isActive ? 'font-semibold' : 'opacity-60',
                                ].join(' ')
                            }
                            style={({ isActive }) => ({
                                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            })}
                        >
                            <span className="text-xl">{icon}</span>
                            <span className="text-xs">{label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
