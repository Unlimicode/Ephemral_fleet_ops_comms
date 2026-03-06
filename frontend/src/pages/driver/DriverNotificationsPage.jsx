export default function DriverNotificationsPage() {
    return (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{
                fontSize: '24px', fontWeight: 800, color: 'var(--text-dark)',
                fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px'
            }}>
                Notifications
            </h1>

            <div style={{
                padding: '48px 24px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '12px',
                border: '1.5px dashed rgba(13,13,13,0.1)', borderRadius: '24px',
                background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(20px)',
                marginTop: '12px'
            }}>
                <span style={{ fontSize: '32px' }}>🔕</span>
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>No notifications yet</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Push notification events from your trip history will appear here (Sprint 15).
                </p>
            </div>
        </div>
    );
}
