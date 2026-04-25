// ─────────────────────────────────────────────────────────────────────────────
// PushNotificationToggle — Driver Push Notification Control
// ─────────────────────────────────────────────────────────────────────────────

import usePushNotifications from '../hooks/usePushNotifications';

// PushNotificationToggle renders a toggle button that allows a driver to
// enable or disable push notifications. The component renders nothing when the
// browser does not support the Push API. The caller is responsible for
// supplying the driver auth token, which is forwarded to the backend when
// registering or removing the subscription.
export default function PushNotificationToggle({ token }) {
    const { supported, subscribed, subscribe, unsubscribe, loading, error } =
        usePushNotifications(token);

    if (!supported) return null;

    function handleClick() {
        if (subscribed) {
            unsubscribe(token);
        } else {
            subscribe(token);
        }
    }

    const buttonClass = [
        'px-4 py-2 rounded text-white font-medium transition-colors',
        loading
            ? 'bg-gray-400 cursor-not-allowed'
            : subscribed
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700',
    ].join(' ');

    const label = loading
        ? 'Setting up notifications...'
        : subscribed
            ? 'Disable Notifications'
            : 'Enable Notifications';

    return (
        <div>
            <button
                className={buttonClass}
                onClick={handleClick}
                disabled={loading}
                type="button"
            >
                {label}
            </button>
            {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
        </div>
    );
}
