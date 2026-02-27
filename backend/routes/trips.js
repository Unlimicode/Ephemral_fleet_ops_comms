// ─────────────────────────────────────────────────────────────────────────────
// Trips Router — Protected Trip Management
// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY: client_first_name is the ONLY client identifier accepted at this
// endpoint. No phone number, no last name. This mirrors the data-minimisation
// constraint enforced at the schema level and is intentional by design.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── POST / — Create a new trip ───────────────────────────────────────────────
// Protected: only authenticated fleet managers may create trip records.
// Accepts the six permitted fields; flight_number is optional.
// Returns 201 with the newly created trip row on success.
router.post('/', requireAuth, async (req, res) => {
    const {
        client_corporate_email,
        client_first_name,
        pickup_location,
        destination,
        pickup_time,
        flight_number = null,
    } = req.body;

    // Validate required fields
    if (!client_corporate_email || !client_first_name || !pickup_location || !destination || !pickup_time) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await query(
            `INSERT INTO trips
         (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, flight_number, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
            [client_corporate_email, client_first_name, pickup_location, destination, pickup_time, flight_number]
        );

        return res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[trips] create error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /:tripId/assign — Assign a driver and vehicle to a pending trip ────
// Protected: only authenticated fleet managers may perform assignments.
//
// PRIVACY: The driver is identified by ID only. At the driver interface layer,
// the driver receives only client_first_name from the trip record —
// client_corporate_email is never exposed to the driver layer. This endpoint
// enforces that boundary by operating solely on IDs during assignment.
router.patch('/:tripId/assign', requireAuth, async (req, res) => {
    const { tripId } = req.params;
    const { driver_id, vehicle_id } = req.body;

    if (!driver_id || !vehicle_id) {
        return res.status(400).json({ error: 'driver_id and vehicle_id are required' });
    }

    try {
        // Step 1: Verify the trip exists and is pending
        const tripResult = await query(
            'SELECT id, status FROM trips WHERE id = $1',
            [tripId]
        );

        if (tripResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        if (tripResult.rows[0].status !== 'pending') {
            return res.status(409).json({ error: `Trip is already in status '${tripResult.rows[0].status}'` });
        }

        // Step 2: Verify the driver exists and is active
        const driverResult = await query(
            'SELECT id, active_status FROM drivers WHERE id = $1',
            [driver_id]
        );

        if (driverResult.rows.length === 0 || !driverResult.rows[0].active_status) {
            return res.status(404).json({ error: 'Driver not found or inactive' });
        }

        // Step 3: Assign driver and vehicle, advance status to accepted
        const updateResult = await query(
            `UPDATE trips
       SET assigned_driver_id = $1,
           vehicle_id         = $2,
           status             = 'accepted'
       WHERE id = $3
       RETURNING *`,
            [driver_id, vehicle_id, tripId]
        );

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[trips] assign error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
