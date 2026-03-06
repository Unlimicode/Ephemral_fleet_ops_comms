export default function StatCard({ title, value, subtitle, icon, pulse }) {
    return (
        <div className={`glass-card ${pulse ? 'session-pulse' : ''}`} style={{
            padding: '24px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: 'rgba(13,13,13,0.06)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                }}>
                    {icon}
                </div>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                    {title}
                </h3>
            </div>

            <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: '2rem',
                fontWeight: 700, color: 'var(--text-dark)',
                lineHeight: 1, marginBottom: '8px'
            }}>
                {value}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {subtitle}
            </div>

            <div style={{
                position: 'absolute', top: 0, right: 0,
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'var(--accent-gradient)', opacity: 0.06,
                transform: 'translate(20px, -20px)', pointerEvents: 'none'
            }} />
        </div>
    );
}
