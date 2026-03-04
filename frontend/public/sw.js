/* eslint-env serviceworker */
// ─────────────────────────────────────────────────────────────────────────────
// Fleet Ops Service Worker
// ─────────────────────────────────────────────────────────────────────────────

// ── Push Event Handler ───────────────────────────────────────────────────────
// Receives push messages from the backend via the Web Push protocol. Each
// message contains a JSON payload with title, body, type, and optional tripId.
//
// requireInteraction: true for trip_assigned notifications means the
// notification remains on screen until the driver actively dismisses or taps
// it. This ensures drivers do not miss new assignment notifications even if
// their device is busy or the screen is locked.
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: data.tripId || 'fleet-ops-notification',
        data: {
            tripId: data.tripId,
            type: data.type,
            url: data.tripId ? `/driver/trips/${data.tripId}` : '/driver/trips',
        },
        requireInteraction: data.type === 'trip_assigned',
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ── Notification Click Handler ───────────────────────────────────────────────
// The click handler first checks if the target URL is already open in a
// browser tab and focuses it rather than opening a duplicate. If the app is
// not open, it opens a new window to the relevant trip page. This ensures the
// driver lands directly on the assigned trip view when tapping the
// notification.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/driver/trips';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
