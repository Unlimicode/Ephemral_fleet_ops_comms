// ─────────────────────────────────────────────────────────────────────────────
// SwiftLink Service Worker
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'swiftlink-v1';

// App shell pages to pre-cache so the driver PWA loads offline
const SHELL = ['/', '/driver/trips', '/driver/trips/active', '/driver/profile', '/driver/notifications'];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            cache.addAll(SHELL).catch(() => {})
        )
    );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== CACHE_NAME)
                        .map((k) => caches.delete(k))
                )
            ),
        ])
    );
});

// ── Fetch — cache-first for same-origin assets, network-only for cross-origin ─
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Only intercept same-origin requests (the Vite app shell + built assets).
    // API calls are always cross-origin and must be network-only so drivers
    // always see live trip data when online.
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            // Serve cache immediately while revalidating in the background
            const network = fetch(event.request)
                .then((res) => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
                    }
                    return res;
                })
                .catch(() => cached);

            return cached || network;
        })
    );
});

// ── Background Sync — notify clients to refresh trip data ────────────────────
// The browser fires 'sync' when connectivity is restored after the app called
// registration.sync.register('trip-sync') while offline.
self.addEventListener('sync', (event) => {
    if (event.tag === 'trip-sync') {
        event.waitUntil(
            self.clients
                .matchAll({ type: 'window' })
                .then((clientList) => {
                    clientList.forEach((client) =>
                        client.postMessage({ type: 'SYNC_TRIPS' })
                    );
                })
        );
    }
});

// ── Push Event Handler ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    const actions =
        data.type === 'trip_assigned'
            ? [{ action: 'view', title: 'View Trip' }]
            : [];

    const options = {
        body: data.body,
        icon: '/swiftlink-icon.png',
        badge: '/swiftlink-icon.png',
        tag: data.tripId ? `${data.type || 'notif'}-${data.tripId}` : 'fleet-ops-notification',
        data: {
            tripId: data.tripId,
            type: data.type,
            url: data.tripId ? `/driver/trips/${data.tripId}` : '/driver/trips',
        },
        requireInteraction: data.type === 'trip_assigned',
        actions,
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ── Notification Click Handler ───────────────────────────────────────────────
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
