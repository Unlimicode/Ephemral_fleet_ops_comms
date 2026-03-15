import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { getIo } from '../socket/io.js';
import { emitDashboardEvent } from '../socket/dashboardNamespace.js';
import { setSession, deleteSession } from '../config/redisHelpers.js';

const router = Router();

// ── GET / — Get All Trips (Manager View) ───────────────────────────────────
router.get('/', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const result = await query(
            `SELECT t.*, 
                    d.full_name as driver_name,
                    v.registration_number as vehicle_reg
             FROM trips t
             LEFT JOIN drivers d ON t.assigned_driver_id = d.id
             LEFT JOIN vehicles v ON t.vehicle_id = v.id
             ORDER BY t.pickup_time DESC`
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('[trips] get all error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── POST / — Create New Trip Booking ──────────────────────────────────────────
router.post('/', requireAuth(['fleet_manager']), async (req, res) => {
    const { client_corporate_email, client_first_name, pickup_location, destination, pickup_time } = req.body;

    if (!client_corporate_email || !client_first_name || !pickup_location || !destination || !pickup_time) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await query(
            `INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, status)
             VALUES ($1, $2, $3, $4, $5, 'pending')
             RETURNING id, status, client_first_name`,
            [client_corporate_email, client_first_name, pickup_location, destination, pickup_time]
        );

        const newTrip = result.rows[0];

        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_CREATED', req.user.id, 'fleet_manager', newTrip.id, { client_corporate_email }]
        );

        return res.status(201).json(newTrip);
    } catch (err) {
        console.error('[trips] create error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /:tripId/assign — Assign Driver and Vehicle ────────────────────────
router.patch('/:tripId/assign', requireAuth(['fleet_manager']), async (req, res) => {
    const { tripId } = req.params;
    const { driver_id, vehicle_id } = req.body;

    if (!driver_id || !vehicle_id) {
        return res.status(400).json({ error: 'Driver and vehicle are required for assignment' });
    }

    try {
        // Update trip status to 'accepted' (meaning assigned in this flow)
        const result = await query(
            `UPDATE trips 
             SET assigned_driver_id = $1, vehicle_id = $2, status = 'accepted' 
             WHERE id = $3 AND status = 'pending'
             RETURNING *`,
            [driver_id, vehicle_id, tripId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found or not in pending status' });
        }

        const trip = result.rows[0];

        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_ASSIGNED', req.user.id, 'fleet_manager', tripId, { driver_id, vehicle_id }]
        );

        emitDashboardEvent('trip_assigned', { trip_id: tripId, driver_id });

        return res.status(200).json(trip);
    } catch (err) {
        console.error('[trips] assign error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /:tripId/accept — Accept Assignment (Driver) ──────────────────────
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


        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_ACCEPTED', driverId, 'driver', tripId, {}]
        );

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /:tripId/complete — Complete Trip (Driver) ────────────────────────
router.patch('/:tripId/complete', requireAuth(['driver']), async (req, res) => {
    const { tripId } = req.params;
    const driverId = req.user.id;
    try {
        const updateResult = await query(
            `UPDATE trips SET status = 'completed' WHERE id = $1 AND assigned_driver_id = $2 AND status = 'in_progress' RETURNING *`,
            [tripId, driverId]
        );
        if (updateResult.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });

        await deleteSession(`session:trip:${tripId}:driver`);
        await deleteSession(`session:trip:${tripId}:client`);
        await setSession(`complaint:window:${tripId}`, { active: true }, 86400);

        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_COMPLETED', driverId, 'driver', tripId, {}]
        );

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
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
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;