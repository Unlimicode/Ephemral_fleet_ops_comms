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

export default router;
