const tints = {
    green: { arc: 'rgba(0,245,160,0.12)', icon: 'rgba(0,245,160,0.15)' },
    amber: { arc: 'rgba(255,180,0,0.12)', icon: 'rgba(255,180,0,0.15)' },
    blue: { arc: 'rgba(0,212,255,0.12)', icon: 'rgba(0,212,255,0.15)' },
    purple: { arc: 'rgba(108,99,255,0.12)', icon: 'rgba(108,99,255,0.15)' },
};

export default function StatCard({ title, value, subtitle, icon, pulse, tint = 'blue' }) {
    return (
        <div className={`glass-card ${pulse ? 'session-pulse' : ''}`} style={{
            padding: '28px 24px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            cursor: 'default'
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(180,130,80,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
        >
            {/* Decorative arc — top right */}
            <div style={{
                position: 'absolute', top: '-20px', right: '-20px',
                width: '100px', height: '100px',
                borderRadius: '50%',
                background: tints[tint]?.arc || tints['blue'].arc,
                filter: 'blur(20px)'
            }} />

            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                    width: '44px', height: '44px',
                    borderRadius: '12px',
                    background: tints[tint]?.icon || tints['blue'].icon,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px'
                }}>{icon}</div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{title}</span>
            </div>

            {/* Value */}
            <div style={{
                fontSize: '3rem', fontWeight: 800,
                color: 'var(--text-dark)',
                letterSpacing: '-2px', lineHeight: 1,
                marginBottom: '6px',
                fontFamily: 'Inter, sans-serif'
            }}>{value}</div>

            {/* Subtitle */}
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</div>
        </div>
    );
}
