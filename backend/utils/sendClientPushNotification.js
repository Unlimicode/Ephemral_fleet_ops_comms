// ─────────────────────────────────────────────────────────────────────────────
// Client Push Notification Delivery Utility
// ─────────────────────────────────────────────────────────────────────────────
// Mirrors sendPushNotification.js but queries client_push_subscriptions by
// client_email rather than push_subscriptions by driver_id.
//
// Clients have no persistent UUID — email is the identity anchor. No notification
// history record is persisted for clients (no client_notifications table).
//
// 404 and 410 from the push service indicate the subscription is stale — deleted
// automatically to prevent repeat failures. All errors are swallowed after
// logging; a push failure must never block the calling endpoint.
// ─────────────────────────────────────────────────────────────────────────────

import webpush from '../config/webpush.js';
import { query } from '../config/db.js';

export async function sendClientPushNotification(clientEmail, payload) {
    webpush.setVapidDetails(
        process.env.VAPID_MAILTO,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );

    const result = await query(
        'SELECT endpoint, p256dh, auth FROM client_push_subscriptions WHERE client_email = $1',
        [clientEmail]
    );

    if (result.rows.length === 0) return;

    for (const row of result.rows) {
        const pushSubscription = {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
        };

        try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
            console.log(`[client-push] Sent to ${clientEmail} (${row.endpoint.slice(0, 50)}...)`);
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
                console.warn(`[client-push] Stale subscription removed for ${clientEmail} (${err.statusCode})`);
                await query(
                    'DELETE FROM client_push_subscriptions WHERE endpoint = $1',
                    [row.endpoint]
                );
            } else {
                console.error('[client-push] Notification failed for endpoint:', row.endpoint.slice(0, 50), err.message);
            }
        }
    }
}
