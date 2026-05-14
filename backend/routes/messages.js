// ─────────────────────────────────────────────────────────────────────────────
// Direct Messages — always-on threads
//   manager ↔ driver  (keyed by driver_id)
//   manager ↔ client  (keyed by client_corporate_email)
//
// Separate from the trip-scoped client↔driver relay. These threads persist
// across trips so drivers and clients can reach the manager any time.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireClientAuth } from '../middleware/clientAuth.js';
import { emitDashboardEvent } from '../socket/dashboardNamespace.js';
import { sendPushNotification } from '../utils/sendPushNotification.js';
import { sendClientPushNotification } from '../utils/sendClientPushNotification.js';

const router = Router();

const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ── Manager — list driver threads ────────────────────────────────────────────
router.get('/threads/drivers', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const result = await query(
            `WITH thread_messages AS (
                SELECT
                    dm.driver_id,
                    dm.body,
                    dm.sender_role,
                    dm.created_at,
                    dm.read_by_manager_at,
                    ROW_NUMBER() OVER (PARTITION BY dm.driver_id ORDER BY dm.created_at DESC) AS rn
                FROM direct_messages dm
                WHERE dm.driver_id IS NOT NULL
            )
            SELECT
                d.id AS driver_id,
                d.full_name AS driver_name,
                d.work_email AS driver_email,
                tm.body AS last_message,
                tm.sender_role AS last_sender_role,
                tm.created_at AS last_message_at,
                COALESCE(unread.cnt, 0) AS unread_count
            FROM drivers d
            LEFT JOIN thread_messages tm ON tm.driver_id = d.id AND tm.rn = 1
            LEFT JOIN (
                SELECT driver_id, COUNT(*) AS cnt
                FROM direct_messages
                WHERE driver_id IS NOT NULL
                  AND sender_role = 'driver'
                  AND read_by_manager_at IS NULL
                GROUP BY driver_id
            ) unread ON unread.driver_id = d.id
            WHERE d.active_status = TRUE
            ORDER BY tm.created_at DESC NULLS LAST, d.full_name ASC`
        );
        return res.json(result.rows);
    } catch (err) {
        console.error('[messages] threads/drivers error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Manager — list client threads ────────────────────────────────────────────
router.get('/threads/clients', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const result = await query(
            `WITH thread_messages AS (
                SELECT
                    dm.client_email,
                    dm.body,
                    dm.sender_role,
                    dm.created_at,
                    ROW_NUMBER() OVER (PARTITION BY dm.client_email ORDER BY dm.created_at DESC) AS rn
                FROM direct_messages dm
                WHERE dm.client_email IS NOT NULL
            ),
            client_names AS (
                SELECT DISTINCT ON (client_corporate_email)
                    client_corporate_email AS client_email,
                    client_first_name
                FROM trips
                ORDER BY client_corporate_email, pickup_time DESC
            )
            SELECT
                tm.client_email,
                COALESCE(cn.client_first_name, '') AS client_first_name,
                tm.body AS last_message,
                tm.sender_role AS last_sender_role,
                tm.created_at AS last_message_at,
                COALESCE(unread.cnt, 0) AS unread_count
            FROM thread_messages tm
            LEFT JOIN client_names cn ON cn.client_email = tm.client_email
            LEFT JOIN (
                SELECT client_email, COUNT(*) AS cnt
                FROM direct_messages
                WHERE client_email IS NOT NULL
                  AND sender_role = 'client'
                  AND read_by_manager_at IS NULL
                GROUP BY client_email
            ) unread ON unread.client_email = tm.client_email
            WHERE tm.rn = 1
            ORDER BY tm.created_at DESC`
        );
        return res.json(result.rows);
    } catch (err) {
        console.error('[messages] threads/clients error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Manager — fetch driver thread ────────────────────────────────────────────
router.get('/threads/driver/:driverId', requireAuth(['fleet_manager']), async (req, res) => {
    const { driverId } = req.params;
    try {
        const driverRow = await query(
            'SELECT id, full_name, work_email FROM drivers WHERE id = $1',
            [driverId]
        );
        if (driverRow.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        const result = await query(
            `SELECT id, sender_role, body, created_at
             FROM direct_messages
             WHERE driver_id = $1
             ORDER BY created_at ASC`,
            [driverId]
        );
        // Mark unread driver-sent messages as read by manager
        await query(
            `UPDATE direct_messages
             SET read_by_manager_at = NOW()
             WHERE driver_id = $1 AND sender_role = 'driver' AND read_by_manager_at IS NULL`,
            [driverId]
        );
        return res.json({ driver: driverRow.rows[0], messages: result.rows });
    } catch (err) {
        console.error('[messages] driver thread fetch error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Manager — fetch client thread ────────────────────────────────────────────
router.get('/threads/client/:email', requireAuth(['fleet_manager']), async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    if (!isEmail(email)) return res.status(400).json({ error: 'Invalid email' });

    try {
        const nameRow = await query(
            `SELECT client_first_name FROM trips
             WHERE client_corporate_email = $1
             ORDER BY pickup_time DESC LIMIT 1`,
            [email]
        );
        const result = await query(
            `SELECT id, sender_role, body, created_at
             FROM direct_messages
             WHERE client_email = $1
             ORDER BY created_at ASC`,
            [email]
        );
        await query(
            `UPDATE direct_messages
             SET read_by_manager_at = NOW()
             WHERE client_email = $1 AND sender_role = 'client' AND read_by_manager_at IS NULL`,
            [email]
        );
        return res.json({
            client: {
                client_email: email,
                client_first_name: nameRow.rows[0]?.client_first_name || ''
            },
            messages: result.rows
        });
    } catch (err) {
        console.error('[messages] client thread fetch error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Manager — send to driver ─────────────────────────────────────────────────
router.post('/threads/driver/:driverId', requireAuth(['fleet_manager']), async (req, res) => {
    const { driverId } = req.params;
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body required' });

    try {
        const driverCheck = await query('SELECT id FROM drivers WHERE id = $1 AND active_status = TRUE', [driverId]);
        if (driverCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        const result = await query(
            `INSERT INTO direct_messages (driver_id, sender_role, body, read_by_manager_at)
             VALUES ($1, 'fleet_manager', $2, NOW()) RETURNING *`,
            [driverId, body.trim()]
        );
        const message = result.rows[0];

        await query(
            `INSERT INTO driver_notifications (driver_id, type, title, body)
             VALUES ($1, 'direct_message', 'Message from Manager', $2)`,
            [driverId, body.trim()]
        );

        try {
            emitDashboardEvent('direct_message', {
                scope: 'driver',
                driver_id: driverId,
                sender_role: 'fleet_manager',
                body: message.body,
                created_at: message.created_at,
            });
        } catch (socketErr) {
            console.error('[messages] socket emit failed (non-fatal):', socketErr.message);
        }

        if (process.env.NODE_ENV !== 'test') {
            sendPushNotification(driverId, {
                title: 'Message from Manager',
                body: body.trim().slice(0, 80),
                type: 'direct_message',
            }).catch(() => {});
        }

        return res.status(201).json(message);
    } catch (err) {
        console.error('[messages] manager→driver send error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Manager — send to client ─────────────────────────────────────────────────
router.post('/threads/client/:email', requireAuth(['fleet_manager']), async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const { body } = req.body;
    if (!isEmail(email)) return res.status(400).json({ error: 'Invalid email' });
    if (!body?.trim()) return res.status(400).json({ error: 'Message body required' });

    try {
        const result = await query(
            `INSERT INTO direct_messages (client_email, sender_role, body, read_by_manager_at)
             VALUES ($1, 'fleet_manager', $2, NOW()) RETURNING *`,
            [email, body.trim()]
        );
        const message = result.rows[0];

        try {
            emitDashboardEvent('direct_message', {
                scope: 'client',
                client_email: email,
                sender_role: 'fleet_manager',
                body: message.body,
                created_at: message.created_at,
            });
        } catch (socketErr) {
            console.error('[messages] socket emit failed (non-fatal):', socketErr.message);
        }

        if (process.env.NODE_ENV !== 'test') {
            sendClientPushNotification(email, {
                title: 'Message from Fleet Manager',
                body: body.trim().slice(0, 80),
                type: 'manager_message',
            }).catch(() => {});
        }

        return res.status(201).json(message);
    } catch (err) {
        console.error('[messages] manager→client send error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Driver — fetch own thread with manager ───────────────────────────────────
router.get('/driver/mine', requireAuth(['driver']), async (req, res) => {
    const driverId = req.user.id;
    try {
        const result = await query(
            `SELECT id, sender_role, body, created_at
             FROM direct_messages
             WHERE driver_id = $1
             ORDER BY created_at ASC`,
            [driverId]
        );
        await query(
            `UPDATE direct_messages
             SET read_by_recipient_at = NOW()
             WHERE driver_id = $1 AND sender_role = 'fleet_manager' AND read_by_recipient_at IS NULL`,
            [driverId]
        );
        return res.json(result.rows);
    } catch (err) {
        console.error('[messages] driver own thread error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Driver — send to manager ─────────────────────────────────────────────────
router.post('/driver/mine', requireAuth(['driver']), async (req, res) => {
    const driverId = req.user.id;
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body required' });

    try {
        const result = await query(
            `INSERT INTO direct_messages (driver_id, sender_role, body, read_by_recipient_at)
             VALUES ($1, 'driver', $2, NOW()) RETURNING *`,
            [driverId, body.trim()]
        );
        const message = result.rows[0];

        try {
            emitDashboardEvent('direct_message', {
                scope: 'driver',
                driver_id: driverId,
                sender_role: 'driver',
                body: message.body,
                created_at: message.created_at,
            });
        } catch (socketErr) {
            console.error('[messages] socket emit failed (non-fatal):', socketErr.message);
        }

        return res.status(201).json(message);
    } catch (err) {
        console.error('[messages] driver→manager send error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Client — fetch own thread with manager ───────────────────────────────────
router.get('/client/mine', requireClientAuth, async (req, res) => {
    const email = req.client.client_corporate_email;
    try {
        const result = await query(
            `SELECT id, sender_role, body, created_at
             FROM direct_messages
             WHERE client_email = $1
             ORDER BY created_at ASC`,
            [email]
        );
        await query(
            `UPDATE direct_messages
             SET read_by_recipient_at = NOW()
             WHERE client_email = $1 AND sender_role = 'fleet_manager' AND read_by_recipient_at IS NULL`,
            [email]
        );
        return res.json(result.rows);
    } catch (err) {
        console.error('[messages] client own thread error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Client — send to manager ─────────────────────────────────────────────────
router.post('/client/mine', requireClientAuth, async (req, res) => {
    const email = req.client.client_corporate_email;
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body required' });

    try {
        const result = await query(
            `INSERT INTO direct_messages (client_email, sender_role, body, read_by_recipient_at)
             VALUES ($1, 'client', $2, NOW()) RETURNING *`,
            [email, body.trim()]
        );
        const message = result.rows[0];

        try {
            emitDashboardEvent('direct_message', {
                scope: 'client',
                client_email: email,
                sender_role: 'client',
                body: message.body,
                created_at: message.created_at,
            });
        } catch (socketErr) {
            console.error('[messages] socket emit failed (non-fatal):', socketErr.message);
        }

        return res.status(201).json(message);
    } catch (err) {
        console.error('[messages] client→manager send error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
