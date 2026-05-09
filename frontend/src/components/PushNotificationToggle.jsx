import usePushNotifications from '../hooks/usePushNotifications';

export default function PushNotificationToggle({ token }) {
    const { supported, subscribed, subscribe, unsubscribe, loading, error } =
        usePushNotifications(token);

    if (!supported) return null;

    function handleToggle() {
        if (subscribed) {
            unsubscribe(token);
        } else {
            subscribe(token);
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '18px', color: subscribed ? '#6C63FF' : 'rgba(0,0,0,0.3)', transition: 'color 0.2s' }}
                    >
                        {subscribed ? 'notifications_active' : 'notifications'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)' }}>
                        {loading ? 'Updating…' : subscribed ? 'Push notifications on' : 'Enable push notifications'}
                    </span>
                </div>

                {/* Toggle pill */}
                <button
                    type="button"
                    onClick={handleToggle}
                    disabled={loading}
                    aria-checked={subscribed}
                    role="switch"
                    style={{
                        flexShrink: 0,
                        width: '44px',
                        height: '24px',
                        borderRadius: '12px',
                        border: 'none',
                        padding: 0,
                        background: subscribed ? '#6C63FF' : 'rgba(0,0,0,0.15)',
                        transition: 'background 0.2s',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        position: 'relative',
                        opacity: loading ? 0.6 : 1,
                    }}
                >
                    <div
                        style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: '#FFF',
                            position: 'absolute',
                            top: '3px',
                            left: subscribed ? '23px' : '3px',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                        }}
                    />
                </button>
            </div>

            {error && (
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#E05A5A' }}>{error}</p>
            )}
        </div>
    );
}
