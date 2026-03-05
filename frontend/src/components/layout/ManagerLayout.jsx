import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_LINKS = [
    { to: '/manager/dispatch', label: 'Dispatch' },
    { to: '/manager/drivers', label: 'Drivers' },
    { to: '/manager/vehicles', label: 'Vehicles' },
    { to: '/manager/complaints', label: 'Complaints' },
    { to: '/manager/dashboard', label: 'Dashboard' },
    { to: '/manager/audit', label: 'Audit' },
];

// ManagerLayout renders the fleet manager shell: pill-shaped top header with
// gradient logo, neomorphic pill navigation, and user controls. Page content
// is rendered via <Outlet /> in the main content area below the header.
export default function ManagerLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    async function handleLogout() {
        await logout();
        navigate('/login', { replace: true });
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
            {/* Top header */}
            <header
                style={{
                    background: 'var(--bg-card-solid)',
                    backdropFilter: 'var(--glass-blur)',
                    WebkitBackdropFilter: 'var(--glass-blur)',
                    borderBottom: 'var(--glass-border)',
                    boxShadow: 'var(--glass-shadow)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                }}
            >
                <div className="flex items-center justify-between px-6 py-3 max-w-screen-xl mx-auto">
                    {/* Logo */}
                    <span
                        className="gradient-text text-xl font-bold tracking-tight"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                        Swiftlink
                    </span>

                    {/* Navigation */}
                    <nav className="flex items-center gap-2">
                        {NAV_LINKS.map(({ to, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) =>
                                    [
                                        'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300',
                                        isActive
                                            ? 'text-white'
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                                    ].join(' ')
                                }
                                style={({ isActive }) =>
                                    isActive
                                        ? { background: 'var(--accent-gradient)' }
                                        : {
                                            boxShadow:
                                                'inset 2px 2px 5px rgba(0,0,0,0.06), inset -2px -2px 5px rgba(255,255,255,0.7)',
                                        }
                                }
                            >
                                {label}
                            </NavLink>
                        ))}
                    </nav>

                    {/* User controls */}
                    <div className="flex items-center gap-3">
                        <span
                            className="text-sm font-medium"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            {user?.full_name || user?.name || 'Manager'}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300"
                            style={{
                                background: 'var(--accent-gradient)',
                                color: '#fff',
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Page content */}
            <main style={{ backgroundColor: 'var(--bg-base)' }}>
                <Outlet />
            </main>
        </div>
    );
}
