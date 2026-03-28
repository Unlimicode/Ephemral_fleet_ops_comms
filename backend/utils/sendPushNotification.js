// ─────────────────────────────────────────────────────────────────────────────
// Push Notification Delivery Utility
// ─────────────────────────────────────────────────────────────────────────────
// 404 and 410 responses from a push service indicate the subscription is no
// longer valid — the browser has unsubscribed or the subscription has expired.
// Deleting these automatically keeps the push_subscriptions table clean and
// prevents repeated failed delivery attempts to dead endpoints.
//
// Push notifications are best-effort delivery. A failure at this layer must
// never block or fail the caller — all errors are swallowed after logging.
// ─────────────────────────────────────────────────────────────────────────────

import webpush from '../config/webpush.js';
import { query } from '../config/db.js';

export async function sendPushNotification(driverId, payload) {
    // Configure VAPID at call time so that importing this module in test suites
    // without VAPID env vars does not throw during module initialisation.
    webpush.setVapidDetails(
        process.env.VAPID_MAILTO,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );

    const result = await query(
        'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE driver_id = $1',
        [driverId]
    );

    if (result.rows.length === 0) return;

    // Persist notification record once per send attempt (before per-subscription loop)
    try {
        await query(
            `INSERT INTO driver_notifications (driver_id, title, body, type, trip_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [driverId, payload.title, payload.body, payload.type, payload.tripId || null]
        );
    } catch (dbErr) {
        console.error('[push] Failed to persist notification record:', dbErr.message);
    }

    for (const row of result.rows) {
        const pushSubscription = {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
        };

        try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
                // Subscription is expired or revoked — remove it to prevent repeat failures.
                await query(
                    'DELETE FROM push_subscriptions WHERE endpoint = $1',
                    [row.endpoint]
                );
            } else {
                console.error('[push] Notification failed for endpoint:', row.endpoint, err.message);
            }
        }
    }
}
