import { Router } from 'express';
import { query } from '../config/db.js';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { getIo } from '../socket/io.js';
import { emitDashboardEvent } from '../socket/dashboardNamespace.js';
import { setSession, deleteSession } from '../config/redisHelpers.js';
import { sendEmail, sendBookingConfirmation } from '../config/mailer.js';
import { sendPushNotification } from '../utils/sendPushNotification.js';
import crypto from 'crypto';

const router = Router();

// ── GET / — Get All Trips (Manager View) ───────────────────────────────────
router.get('/', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const result = await query(
            `SELECT t.*, d.full_name as driver_name, v.registration_number as vehicle_reg
             FROM trips t
             LEFT JOIN drivers d ON t.assigned_driver_id = d.id
             LEFT JOIN vehicles v ON t.vehicle_id = v.id
             ORDER BY t.pickup_time DESC`
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('[trips] get all error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

// ── POST / — Create New Trip Booking ──────────────────────────────────────────
router.post('/', requireAuth(['fleet_manager']), async (req, res) => {
    const { client_corporate_email, client_first_name, pickup_location, destination, pickup_time, flight_number = null, notes = null, send_magic_link = false } = req.body;

    if (!client_corporate_email || !client_first_name || !pickup_location || !destination || !pickup_time) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await query(
            `INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, flight_number, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [client_corporate_email, client_first_name, pickup_location, destination, pickup_time, flight_number, notes]
        );

        const trip = result.rows[0];

        if (send_magic_link && process.env.NODE_ENV !== 'test') {
            try {
                const token = crypto.randomBytes(32).toString('hex');
                await setSession(`booking_access_token:${token}`, { trip_id: trip.id, client_email: client_corporate_email }, 172800);
                const magicLink = `${process.env.CLIENT_ORIGIN}/booking?token=${token}&tripId=${trip.id}`;
                await sendBookingConfirmation(client_corporate_email, magicLink);
            } catch (mailErr) {
                console.error('[trips] magic link send failed:', mailErr.message);
            }
        }

        return res.status(201).json(trip);
    } catch (err) {
        console.error('[trips] create error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

// ── PATCH /:tripId/assign — Assign Driver & Vehicle ──────────────────────────
router.patch('/:tripId/assign', requireAuth(['fleet_manager']), async (req, res) => {
    const { tripId } = req.params;
    const { driver_id, vehicle_id } = req.body;

    if (!driver_id || !vehicle_id) {
        return res.status(400).json({ error: 'driver_id and vehicle_id are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Trip status guard — must be pending
        const tripCheck = await client.query(
            'SELECT id FROM trips WHERE id = $1 AND status = $2',
            [tripId, 'pending']
        );
        if (tripCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Trip is not in pending status and cannot be assigned.' });
        }

        // 2. Driver conflict check — not already on an active trip
        const driverConflict = await client.query(
            `SELECT id FROM trips WHERE assigned_driver_id = $1 AND status IN ('accepted', 'in_progress')`,
            [driver_id]
        );
        if (driverConflict.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'This driver is already assigned to an active trip.' });
        }

        // 3. Vehicle conflict check — not already deployed on an active trip
        const vehicleConflict = await client.query(
            `SELECT id FROM trips WHERE vehicle_id = $1 AND status IN ('accepted', 'in_progress')`,
            [vehicle_id]
        );
        if (vehicleConflict.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'This vehicle is already deployed on an active trip.' });
        }

        // 4. Assign
        const result = await client.query(
            `UPDATE trips
             SET assigned_driver_id = $1, vehicle_id = $2, status = 'accepted'
             WHERE id = $3
             RETURNING *`,
            [driver_id, vehicle_id, tripId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Trip not found' });
        }

        await client.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_ASSIGNED', req.user.id, 'fleet_manager', tripId, { driver_id, vehicle_id }]
        );

        await client.query('COMMIT');

        const trip = result.rows[0];
        emitDashboardEvent('trip_assigned', { trip_id: tripId, driver_id });

        if (process.env.NODE_ENV !== 'test') {
            sendPushNotification(driver_id, {
                title: 'New Trip Assigned',
                body: 'You have been assigned a new trip. Open the app to view details.',
                type: 'trip_assigned',
                tripId,
            }).catch(() => {});
        }

        return res.status(200).json(trip);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[trips] assign error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    } finally {
        client.release();
    }
});

// ── PATCH /:tripId/reassign — Reassign Driver & Vehicle (Manager Only) ────────
router.patch('/:tripId/reassign', requireAuth(['fleet_manager']), async (req, res) => {
    const { tripId } = req.params;
    const { driver_id, vehicle_id } = req.body;

    if (!driver_id || !vehicle_id) {
        return res.status(400).json({ error: 'driver_id and vehicle_id are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Trip must be in accepted status
        const tripCheck = await client.query(
            'SELECT id, assigned_driver_id FROM trips WHERE id = $1 AND status = $2',
            [tripId, 'accepted']
        );
        if (tripCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Trip is not in accepted status and cannot be reassigned.' });
        }

        const oldDriverId = tripCheck.rows[0].assigned_driver_id;

        // 2. New driver conflict — not already on a different active trip
        const driverConflict = await client.query(
            `SELECT id FROM trips WHERE assigned_driver_id = $1 AND status IN ('accepted', 'in_progress') AND id != $2`,
            [driver_id, tripId]
        );
        if (driverConflict.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'This driver is already assigned to an active trip.' });
        }

        // 3. New vehicle conflict
        const vehicleConflict = await client.query(
            `SELECT id FROM trips WHERE vehicle_id = $1 AND status IN ('accepted', 'in_progress') AND id != $2`,
            [vehicle_id, tripId]
        );
        if (vehicleConflict.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'This vehicle is already deployed on an active trip.' });
        }

        // 4. Reassign
        const result = await client.query(
            `UPDATE trips SET assigned_driver_id = $1, vehicle_id = $2 WHERE id = $3 RETURNING *`,
            [driver_id, vehicle_id, tripId]
        );

        await client.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_REASSIGNED', req.user.id, 'fleet_manager', tripId, { old_driver_id: oldDriverId, new_driver_id: driver_id, vehicle_id }]
        );

        await client.query('COMMIT');

        const trip = result.rows[0];
        emitDashboardEvent('trip_reassigned', { trip_id: tripId, old_driver_id: oldDriverId, new_driver_id: driver_id });

        if (process.env.NODE_ENV !== 'test') {
            if (oldDriverId) {
                sendPushNotification(oldDriverId, {
                    title: 'Trip Unassigned',
                    body: 'Your trip assignment has been cancelled by the fleet manager.',
                    type: 'trip_unassigned',
                    tripId,
                }).catch(() => {});
            }
            sendPushNotification(driver_id, {
                title: 'New Trip Assigned',
                body: 'You have been assigned a trip. Open the app to view details.',
                type: 'trip_assigned',
                tripId,
            }).catch(() => {});
        }

        return res.status(200).json(trip);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[trips] reassign error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    } finally {
        client.release();
    }
});

// ── PATCH /:tripId/accept — Accept Assignment (Driver Fallback) ───────────────
router.patch('/:tripId/accept', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;
    try {
        const tripCheck = await query(
            'SELECT id, client_corporate_email FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status = $3',
            [tripId, driverId, 'accepted']
        );
        if (tripCheck.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });

        const updateResult = await query(
            `UPDATE trips SET status = 'in_progress' WHERE id = $1 RETURNING *`,
            [tripId]
        );

        await setSession(`session:trip:${tripId}:driver`, { driver_id: driverId }, 86400);
        await setSession(`session:trip:${tripId}:client`, { client_email: tripCheck.rows[0].client_corporate_email }, 86400);

        emitDashboardEvent('session_created', { trip_id: tripId, timestamp: new Date().toISOString() });

        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_ACCEPTED', driverId, 'driver', tripId, {}]
        );

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[trips] accept error:', err.message, err.stack);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

// ── PATCH /:tripId/complete — Complete Trip (Driver Fallback) ──────────────────
router.patch('/:tripId/complete', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;

    try {
        const tripCheck = await query(
            'SELECT id FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status = $3',
            [tripId, driverId, 'in_progress']
        );
        if (tripCheck.rows.length === 0) return res.status(404).json({ error: 'Trip not found or not in progress' });

        const result = await query(
            `UPDATE trips SET status = 'completed' WHERE id = $1 RETURNING *`,
            [tripId]
        );

        await deleteSession(`session:trip:${tripId}:driver`);
        await deleteSession(`session:trip:${tripId}:client`);
        await setSession(`complaint:window:${tripId}`, { active: true }, 86400);

        const io = getIo();
        if (io) {
            io.to(`trip:${tripId}`).emit('session_closed', {
                tripId,
                reason: 'Trip completed — communication channel closed',
                complaint_window_hours: 24
            });
        }

        emitDashboardEvent('session_destroyed', { trip_id: tripId, timestamp: new Date().toISOString() });

        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_COMPLETED', driverId, 'driver', tripId, {}]
        );

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('[trips] complete error:', err.message, err.stack);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

// ── PATCH /:tripId/force-complete — Force Complete Trip (Manager) ─────────────
router.patch('/:tripId/force-complete', requireAuth(['fleet_manager']), async (req, res) => {
    const { tripId } = req.params;

    try {
        const tripCheck = await query(
            'SELECT id, assigned_driver_id, client_corporate_email FROM trips WHERE id = $1 AND status = ANY($2::text[])',
            [tripId, ['accepted', 'in_progress']]
        );
        if (tripCheck.rows.length === 0) return res.status(404).json({ error: 'Trip not found or not in progress' });

        const result = await query(
            `UPDATE trips SET status = 'completed' WHERE id = $1 RETURNING *`,
            [tripId]
        );

        await deleteSession(`session:trip:${tripId}:driver`);
        await deleteSession(`session:trip:${tripId}:client`);

        const { assigned_driver_id, client_corporate_email } = tripCheck.rows[0];
        if (assigned_driver_id) {
            await setSession(`driver:availability:${assigned_driver_id}`, { status: 'available', updated_at: new Date().toISOString() });
        }

        await setSession(`complaint:window:${tripId}`, { active: true }, 86400);

        if (process.env.NODE_ENV !== 'test') {
            try {
                await sendEmail({
                    to: client_corporate_email,
                    subject: 'Your trip is complete — you have 24 hours to submit a complaint',
                    text: `Your trip has been completed.\n\nYou have a 24-hour window to file a complaint if needed. After this window, all communication records will no longer be accessible.\n\nLink: ${process.env.CLIENT_ORIGIN}/booking`,
                });
            } catch (mailErr) {
                console.error('[trips] force-complete email failed:', mailErr.message);
            }
        }

        const io = getIo();
        if (io) {
            io.to(`trip:${tripId}`).emit('session_closed', {
                tripId,
                reason: 'Trip completed — communication channel closed',
                complaint_window_hours: 24
            });
        }

        emitDashboardEvent('session_destroyed', { trip_id: tripId, timestamp: new Date().toISOString() });

        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_COMPLETED', req.user.id, 'fleet_manager', tripId, {}]
        );

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('[trips] force-complete error:', err.message, err.stack);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// ── GET /:tripId/session-status — Utility for Dashboard ──────────────────────
router.get('/:tripId/session-status', requireAuth(['fleet_manager', 'driver']), async (req, res) => {
    const { tripId } = req.params;
    try {
        const tripRes = await query('SELECT status FROM trips WHERE id = $1', [tripId]);
        if (tripRes.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });

        const status = tripRes.rows[0].status;

        return res.status(200).json({
            driver_session_active: status === 'in_progress',
            client_session_active: status === 'in_progress',
            complaint_window_active: status === 'completed'
        });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

export default router;