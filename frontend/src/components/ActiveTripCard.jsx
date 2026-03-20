export default function ActiveTripCard({ trip, onComplete, isConfirming, onConfirm, onCancel }) {
    return (
        <div className="glass-card session-pulse" style={{ padding: '24px', overflow: 'visible' }}>
            <style>{`@keyframes confirmFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', margin: '12px 12px 0 0', position: 'relative' }}>
                <span className="session-pulse" style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: 'var(--accent-success)', display: 'inline-block'
                }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    In Progress
                </span>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 12px 0' }}>
                {trip.driver?.full_name || 'Driver'} • {trip.vehicle?.registration_number || 'Vehicle'}
            </h3>

            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.4)', borderRadius: '12px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '4px' }}>
                    Client: {trip.client_first_name}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {trip.pickup_location} <span style={{ color: 'var(--text-muted)' }}>→</span> {trip.destination}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Started: {trip.started_at ? new Date(trip.started_at).toLocaleTimeString() : 'Recently'}
                </p>
            </div>

            {isConfirming ? (
                <div style={{
                    display: 'flex', gap: '8px',
                    animation: 'confirmFadeIn 0.15s ease both'
                }}>
                    <button
                        onClick={onConfirm}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '999px', border: 'none',
                            background: '#6C63FF', color: '#FFF',
                            fontSize: '14px', fontWeight: 700, cursor: 'pointer'
                        }}
                    >
                        Confirm
                    </button>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '999px', border: 'none',
                            background: 'rgba(255,255,255,0.1)', color: 'var(--text-dark)',
                            fontSize: '14px', fontWeight: 700, cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                <button
                    className="glass-button"
                    onClick={() => onComplete(trip.id)}
                    style={{
                        width: '100%', padding: '12px', borderRadius: '12px',
                        color: '#F5EDE3', fontSize: '14px', fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    Mark Complete
                </button>
            )}
        </div>
    );
}
