// GlassCard applies the .glass-card design system class to any container.
// The pulse prop adds the session-pulse animation indicating an active session.
export default function GlassCard({ children, className = '', pulse = false }) {
    const classes = ['glass-card', pulse ? 'session-pulse' : '', className]
        .filter(Boolean)
        .join(' ');
    return <div className={classes}>{children}</div>;
}
