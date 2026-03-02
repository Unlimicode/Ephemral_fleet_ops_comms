import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { setSession, deleteSession } from '../config/redisHelpers.js';
import { getIo } from '../socket/io.js';

const router = Router();

// ── GET / — Driver's Assigned Trips ───────────────────────────────────────────
// Data minimisation enforced at the query level — the driver layer never
// receives client contact details (e.g., client_corporate_email).
router.get('/', requireAuth(['driver']), async (req, res) => {
    try {
        const result = await query(
            `SELECT id, status, pickup_location, destination, pickup_time, flight_number, client_first_name
             FROM trips
             WHERE assigned_driver_id = $1`,
            [req.user.id]
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('[driverTrips] get trips error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /:tripId/accept — Accept Assignment ────────────────────────────────
router.patch('/:tripId/accept', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;

    try {
        // Verify trip exists, is assigned to this driver, and has status accepted
        const tripCheck = await query(
            'SELECT id, client_corporate_email FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status = $3',
            [tripId, driverId, 'accepted']
        );

        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found or not available for acceptance' });
        }

        const trip = tripCheck.rows[0];

        // Update trip status to in_progress
        const updateResult = await query(
            `UPDATE trips SET status = 'in_progress' WHERE id = $1 RETURNING *`,
            [tripId]
        );

        // Create Redis session mappings
        await setSession(`session:trip:${tripId}:driver`, { driver_id: driverId }, 86400);
        await setSession(`session:trip:${tripId}:client`, { client_email: trip.client_corporate_email }, 86400);

        // Update driver availability in Redis
        await setSession(`driver:availability:${driverId}`, { status: 'on_trip', updated_at: new Date().toISOString() });

        // Write TRIP_ACCEPTED to audit_log
        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_ACCEPTED', driverId, 'driver', tripId, {}]
        );

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[driverTrips] accept error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /:tripId/reject — Reject Assignment ────────────────────────────────
router.patch('/:tripId/reject', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;
    const { reason } = req.body;

    if (!reason) {
        return res.status(400).json({ error: 'Reason is required for rejection' });
    }

    try {
        // Verify trip exists, is assigned to this driver, and has status accepted
        const tripCheck = await query(
            'SELECT id FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status = $3',
            [tripId, driverId, 'accepted']
        );

        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found or not available for rejection' });
        }

        // Update trip: set assigned_driver_id to null, vehicle_id to null, status back to pending
        const updateResult = await query(
            `UPDATE trips 
             SET assigned_driver_id = NULL, vehicle_id = NULL, status = 'pending' 
             WHERE id = $1 
             RETURNING *`,
            [tripId]
        );

        // Update driver availability in Redis
        await setSession(`driver:availability:${driverId}`, { status: 'available', updated_at: new Date().toISOString() });

        // Write TRIP_REJECTED to audit_log
        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_REJECTED', driverId, 'driver', tripId, { reason, driver_id: driverId, trip_id: tripId }]
        );

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[driverTrips] reject error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /:tripId/complete — Complete Trip ──────────────────────────────────
router.patch('/:tripId/complete', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;

    try {
        // Verify trip exists, is assigned to this driver, and has status in_progress
        const tripCheck = await query(
            'SELECT id FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status = $3',
            [tripId, driverId, 'in_progress']
        );

        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found or not in progress' });
        }

        // Update trip status to completed
        const updateResult = await query(
            `UPDATE trips SET status = 'completed' WHERE id = $1 RETURNING *`,
            [tripId]
        );

        // Delete Redis session keys
        await deleteSession(`session:trip:${tripId}:driver`);
        await deleteSession(`session:trip:${tripId}:client`);

        // Create complaint window key
        await setSession(`complaint:window:${tripId}`, { active: true }, 86400);

        // Update driver availability
        await setSession(`driver:availability:${driverId}`, { status: 'available', updated_at: new Date().toISOString() });

        // Emit session_closed event
        const io = getIo();
        if (io) {
            io.to(`trip:${tripId}`).emit('session_closed', {
                tripId,
                reason: 'Trip completed — communication channel closed',
                complaint_window_hours: 24
            });
        }

        // Write TRIP_COMPLETED to audit_log
        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_COMPLETED', driverId, 'driver', tripId, {}]
        );

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[driverTrips] complete error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
