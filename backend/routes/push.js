// ─────────────────────────────────────────────────────────────────────────────
// Push Subscription Router — /api/push
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /vapid-public-key ─────────────────────────────────────────────────────
// Public endpoint — no authentication required.
// The VAPID public key is the public half of an asymmetric key pair. It is safe
// to expose to the frontend. The PWA uses it when calling PushManager.subscribe()
// to associate the subscription with this server. The private key never leaves
// the server and is used to sign outbound push requests.
router.get('/vapid-public-key', (_req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// ── POST /subscribe ───────────────────────────────────────────────────────────
// Protected: driver role required.
// Registers or refreshes a driver's browser push subscription.
//
// The upsert (ON CONFLICT DO UPDATE) handles subscription refresh: browsers
// periodically issue a new subscription with the same endpoint but rotated
// encryption keys (p256dh, auth). Without the upsert, the old row would block
// the insert and the refreshed subscription would fail silently on the next
// push attempt.
router.post('/subscribe', requireAuth(['driver']), async (req, res) => {
    const driverId = req.user.id;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'endpoint, keys.p256dh, and keys.auth are required.' });
    }

    await query(
        `INSERT INTO push_subscriptions (driver_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (endpoint)
         DO UPDATE SET p256dh = EXCLUDED.p256dh,
                       auth   = EXCLUDED.auth`,
        [driverId, endpoint, keys.p256dh, keys.auth]
    );

    return res.status(201).json({ message: 'Push subscription registered.' });
});

// ── DELETE /subscribe ─────────────────────────────────────────────────────────
// Protected: driver role required.
// Removes a driver's push subscription by endpoint. The driver_id guard ensures
// a driver can only remove their own subscriptions.
router.delete('/subscribe', requireAuth(['driver']), async (req, res) => {
    const driverId = req.user.id;
    const { endpoint } = req.body;

    if (!endpoint) {
        return res.status(400).json({ error: 'endpoint is required.' });
    }

    await query(
        'DELETE FROM push_subscriptions WHERE endpoint = $1 AND driver_id = $2',
        [endpoint, driverId]
    );

    return res.status(200).json({ message: 'Push subscription removed.' });
});

export default router;
