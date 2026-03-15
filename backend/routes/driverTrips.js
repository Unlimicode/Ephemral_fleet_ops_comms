import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { getIo } from '../socket/io.js';
import { emitDashboardEvent } from '../socket/dashboardNamespace.js';
import transporter from '../config/mailer.js';
import { setSession, deleteSession } from '../config/redisHelpers.js';

const router = Router();

// ── GET / — Get Assigned Trips for Driver ────────────────────────────────────
router.get('/', requireAuth(['driver']), async (req, res) => {
    const driverId = req.user.id;
    try {
        const result = await query(
            `SELECT t.id, t.pickup_location, t.destination, t.pickup_time, t.status, t.assigned_driver_id, t.client_first_name,
                    v.registration_number as vehicle_reg
             FROM trips t
             LEFT JOIN vehicles v ON t.vehicle_id = v.id
             WHERE t.assigned_driver_id = $1 AND t.status != 'completed'
             ORDER BY t.pickup_time ASC`,
            [driverId]
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('[driverTrips] get trips error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

// ── GET /:tripId — Get Specific Trip Detail ──────────────────────────────────
router.get('/:tripId', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;

    try {
        const result = await query(
            `SELECT t.id, t.pickup_location, t.destination, t.pickup_time, t.status, t.assigned_driver_id, t.client_first_name,
                    v.registration_number as vehicle_reg
             FROM trips t
             LEFT JOIN vehicles v ON t.vehicle_id = v.id
             WHERE t.id = $1 AND t.assigned_driver_id = $2`,
            [tripId, driverId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('[driverTrips] get trip detail error:', err.message, err.stack);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

// ── PATCH /:tripId/accept — Accept Assignment ────────────────────────────────
router.patch('/:tripId/accept', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;

    try {
        const tripCheck = await query(
            'SELECT id, client_corporate_email FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status = $3',
            [tripId, driverId, 'accepted']
        );

        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found or not available for acceptance' });
        }

        const updateResult = await query(
            `UPDATE trips SET status = 'in_progress' WHERE id = $1 RETURNING *`,
            [tripId]
        );

        // Update driver availability
        await setSession(`driver:availability:${driverId}`, { status: 'on_trip', updated_at: new Date().toISOString() });

        await setSession(`session:trip:${tripId}:driver`, { driver_id: driverId }, 86400);
        await setSession(`session:trip:${tripId}:client`, { client_email: tripCheck.rows[0].client_corporate_email }, 86400);

        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_ACCEPTED', driverId, 'driver', tripId, {}]
        );

        emitDashboardEvent('session_created', { trip_id: tripId, timestamp: new Date().toISOString() });

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[driverTrips] accept error:', err.message, err.stack);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

// ── PATCH /:tripId/reject — Reject Assignment ────────────────────────────────
router.patch('/:tripId/reject', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;
    const { reason } = req.body || {};

    if (!reason) {
        return res.status(400).json({ error: 'Reason is required for rejection' });
    }

    try {
        const tripCheck = await query(
            'SELECT id FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status = $3',
            [tripId, driverId, 'accepted']
        );

        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found or not available for rejection' });
        }

        const updateResult = await query(
            `UPDATE trips 
             SET assigned_driver_id = NULL, vehicle_id = NULL, status = 'pending' 
             WHERE id = $1 
             RETURNING *`,
            [tripId]
        );

        await setSession(`driver:availability:${driverId}`, { status: 'available', updated_at: new Date().toISOString() });

        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_REJECTED', driverId, 'driver', tripId, { reason }]
        );

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[driverTrips] reject error:', err.message, err.stack);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

// ── PATCH /:tripId/complete — Complete Trip ──────────────────────────────────
router.patch('/:tripId/complete', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;

    try {
        const tripCheck = await query(
            'SELECT id, client_corporate_email FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status = $3',
            [tripId, driverId, 'in_progress']
        );

        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found or not in progress' });
        }

        const updateResult = await query(
            `UPDATE trips SET status = 'completed' WHERE id = $1 RETURNING *`,
            [tripId]
        );

        await deleteSession(`session:trip:${tripId}:driver`);
        await deleteSession(`session:trip:${tripId}:client`);
        await setSession(`complaint:window:${tripId}`, { active: true }, 86400);

        if (process.env.NODE_ENV !== 'test') {
            try {
                await transporter.sendMail({
                    from: process.env.MAIL_FROM || '"Fleet Ops" <noreply@fleetops.dev>',
                    to: tripCheck.rows[0].client_corporate_email,
                    subject: 'Your trip is complete — you have 24 hours to submit feedback',
                    text: `Your trip has been completed.\n\nYou have a 24-hour window to file a complaint if needed. After this window, all communication records will no longer be accessible.\n\nLink: ${process.env.CLIENT_ORIGIN}/booking/${tripId}`
                });
            } catch (emailErr) {
                console.error('[driverTrips] send completion email error:', emailErr);
            }
        }

        await setSession(`driver:availability:${driverId}`, { status: 'available', updated_at: new Date().toISOString() });

        const io = getIo();
        if (io) {
            io.to(`trip:${tripId}`).emit('session_closed', {
                tripId,
                reason: 'Trip completed — communication channel closed',
                complaint_window_hours: 24
            });
        }

        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_COMPLETED', driverId, 'driver', tripId, {}]
        );

        emitDashboardEvent('session_destroyed', { trip_id: tripId, timestamp: new Date().toISOString() });

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[driverTrips] complete error:', err.message, err.stack);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

export default router;