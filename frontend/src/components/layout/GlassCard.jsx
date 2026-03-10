// GlassCard applies the .glass-card design system class to any container.
// The pulse prop adds the session-pulse animation indicating an active session.
// NOTE: This component uses overflow: 'visible' to prevent badge clipping.
// Components requiring internal scroll should use an inner wrapper with overflow: 'auto'.
export default function GlassCard({ children, className = '', pulse = false, style = {} }) {
    const classes = ['glass-card', pulse ? 'session-pulse' : '', className]
        .filter(Boolean)
        .join(' ');
    return <div className={classes} style={{ overflow: 'visible', ...style }}>{children}</div>;
}
