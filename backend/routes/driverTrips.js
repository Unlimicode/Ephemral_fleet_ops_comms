import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { getIo } from '../socket/io.js';
import { emitDashboardEvent } from '../socket/dashboardNamespace.js';
import { sendEmail } from '../config/mailer.js';
import { sendClientPushNotification } from '../utils/sendClientPushNotification.js';
import { setSession, deleteSession } from '../config/redisHelpers.js';
import { computeDestructionHash } from '../utils/encryption.js';
import client from '../config/redis.js';

const router = Router();

// ── GET / — Get Assigned Trips for Driver ────────────────────────────────────
router.get('/', requireAuth(['driver']), async (req, res) => {
    const driverId = req.user.id;
    try {
        const result = await query(
            `SELECT t.id, t.pickup_location, t.destination, t.pickup_time, t.status, t.assigned_driver_id, t.client_first_name,
                    t.additional_info, t.notes, t.flight_number, t.eta,
                    v.registration_number as vehicle_reg
             FROM trips t
             LEFT JOIN vehicles v ON t.vehicle_id = v.id
             WHERE t.assigned_driver_id = $1
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
                    t.additional_info, t.notes, t.flight_number, t.eta,
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
            'SELECT id, client_corporate_email FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status IN ($3, $4)',
            [tripId, driverId, 'pending', 'accepted']
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

        // Push notification to client: driver first name + vehicle info, no contact details.
        // Fire-and-forget — push failure must not block the response.
        if (process.env.NODE_ENV !== 'test') {
            query(
                `SELECT d.full_name, v.make, v.model, v.registration_number
                 FROM trips t
                 JOIN drivers d ON t.assigned_driver_id = d.id
                 LEFT JOIN vehicles v ON t.vehicle_id = v.id
                 WHERE t.id = $1`,
                [tripId]
            ).then(async (r) => {
                if (!r.rows.length) return;
                const { full_name, make, model, registration_number } = r.rows[0];
                const vehicleLabel = [make, model, registration_number].filter(Boolean).join(' · ');
                await sendClientPushNotification(tripCheck.rows[0].client_corporate_email, {
                    title: 'Your driver is on the way',
                    body: vehicleLabel ? `${full_name} — ${vehicleLabel}` : full_name,
                    type: 'driver_accepted',
                    tripId,
                });
            }).catch((err) => console.error('[driverTrips] client push error:', err));
        }

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
            'SELECT id FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status IN ($3, $4)',
            [tripId, driverId, 'pending', 'accepted']
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

        emitDashboardEvent('trip_rejected', { tripId });

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

        // Compute destruction hash BEFORE deleting sessions — captures proof that
        // session data existed at the moment of destruction (DPA 2019 s.41).
        let destructionHash = null;
        try {
            destructionHash = await computeDestructionHash(tripId, client);
        } catch (hashErr) {
            console.error('[driverTrips] destruction hash error:', hashErr);
        }

        await deleteSession(`session:trip:${tripId}:driver`);
        await deleteSession(`session:trip:${tripId}:client`);
        await setSession(`complaint:window:${tripId}`, { active: true }, 86400);

        if (process.env.NODE_ENV !== 'test') {
            try {
                await sendEmail({
                    to: tripCheck.rows[0].client_corporate_email,
                    subject: 'Your trip is complete — you have 24 hours to submit feedback',
                    text: `Your trip has been completed.\n\nYou have a 24-hour window to file a complaint if needed. After this window, all communication records will no longer be accessible.\n\nLink: ${process.env.CLIENT_ORIGIN}/booking`,
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
            `INSERT INTO audit_log
               (action_type, actor_id, actor_role, target_id, details,
                legal_basis, retention_category, destruction_hash, data_subjects)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            ['TRIP_COMPLETED', driverId, 'driver', tripId, {},
             'DPA 2019 s.25 — Data Minimization',
             'ephemeral',
             destructionHash,
             JSON.stringify({ driver_id: driverId, trip_id: tripId })]
        );

        emitDashboardEvent('session_destroyed', {
            trip_id: tripId,
            timestamp: new Date().toISOString(),
            destruction_hash: destructionHash
        });

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[driverTrips] complete error:', err.message, err.stack);
        return res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
    }
});

// ── GET /:tripId/complaint — Driver complaint visibility ──────────────────────
router.get('/:tripId/complaint', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;

    try {
        const tripCheck = await query(
            'SELECT id FROM trips WHERE id = $1 AND assigned_driver_id = $2',
            [tripId, driverId]
        );

        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        const complaintResult = await query(
            `SELECT id, category, status, description, investigation_notes, created_at
             FROM complaints WHERE trip_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [tripId]
        );

        return res.status(200).json({ complaint: complaintResult.rows[0] || null });
    } catch (err) {
        console.error('[driverTrips] complaint fetch error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;