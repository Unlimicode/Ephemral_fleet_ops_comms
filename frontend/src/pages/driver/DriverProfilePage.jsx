import { useAuth } from '../../context/AuthContext.jsx';
import PushNotificationToggle from '../../components/PushNotificationToggle.jsx';

export default function DriverProfilePage() {
    const { user, token, logout } = useAuth();

    return (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 className="kinetic-text reveal-up" style={{
                fontSize: '24px', fontWeight: 800, color: 'var(--text-dark)',
                fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px'
            }}>
                Profile
            </h1>

            <div className="glass-card reveal-up stagger-1" style={{ padding: '24px', borderRadius: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: 'var(--accent-gradient)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#FFF', fontSize: '24px', fontWeight: 800
                    }}>
                        {user?.full_name?.charAt(0) || user?.name?.charAt(0) || 'D'}
                    </div>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>
                            {user?.full_name || user?.name || 'Driver Name'}
                        </h2>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ID: {user?.id}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.4)', padding: '16px', borderRadius: '16px', marginBottom: '24px' }}>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Email Address</div>
                        <div style={{ fontSize: '14px', color: 'var(--text-dark)' }}>{user?.corporate_email || user?.email || 'driver@company.com'}</div>
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <PushNotificationToggle token={token} />
                </div>

                <div style={{ borderTop: '1px solid rgba(13,13,13,0.1)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Session status</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="session-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-success)' }} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-success)', textTransform: 'uppercase' }}>Active since login</span>
                        </div>
                    </div>
                    <button onClick={logout} style={{
                        width: '100%', padding: '16px', borderRadius: '16px',
                        background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(20px)',
                        color: '#F5EDE3', fontSize: '15px', fontWeight: 700,
                        border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(13,13,13,0.15)'
                    }}>
                        Logout Securely
                    </button>
                </div>
            </div>
        </div>
    );
}
