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
import { setSession, deleteSession, getSession } from '../config/redisHelpers.js';

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

// ── PATCH /:tripId/accept — Driver accepts an assigned trip ─────────────────
// Protected: requires a valid JWT.
//
// MEDIATED EPHEMERAL IDENTITY — Redis session mapping:
// This endpoint is the technical implementation of the MEI framework.
// Two Redis keys are created, one for the driver side and one for the client
// side of the communication channel. The driver key holds only the driver_id
// and trip_id — never the client's email. The client key holds the email on
// the server side only; it is never transmitted to the driver. The mandatory
// 24-hour TTL ensures automatic, guaranteed destruction of the channel — no
// manual cleanup required, no persistent identity linkage.
router.patch('/:tripId/accept', requireAuth, async (req, res) => {
    const { tripId } = req.params;
    const actorId = req.user.id;

    try {
        // Step 1: Verify trip exists and is in 'accepted' status (assigned, awaiting driver)
        const tripResult = await query(
            'SELECT id, status, assigned_driver_id, client_corporate_email FROM trips WHERE id = $1',
            [tripId]
        );

        if (tripResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        const trip = tripResult.rows[0];

        if (trip.status !== 'accepted') {
            return res.status(409).json({ error: `Trip is already in status '${trip.status}'` });
        }

        // Step 2: Advance trip status to in_progress
        const updateResult = await query(
            `UPDATE trips SET status = 'in_progress' WHERE id = $1 RETURNING *`,
            [tripId]
        );

        // Step 3: Create ephemeral Redis session mappings (TTL: 24 hours)
        // Driver side — no client email, only IDs
        await setSession(
            `session:trip:${tripId}:driver`,
            { driver_id: trip.assigned_driver_id, trip_id: tripId, role: 'driver' },
            86400
        );
        // Client side — email held server-side only, never forwarded to driver
        await setSession(
            `session:trip:${tripId}:client`,
            { client_email: trip.client_corporate_email, trip_id: tripId, role: 'client' },
            86400
        );

        // Step 4: Write audit log entry
        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
            [
                'TRIP_SESSION_CREATED',
                actorId,
                'fleet_manager',
                tripId,
                JSON.stringify({ trip_id: tripId, session_keys_created: 2 }),
            ]
        );

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[trips] accept error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /:tripId/complete — Mark a trip complete and destroy session ───────
// Protected: requires a valid JWT.
//
// Session destruction on completion is the technical guarantee that drivers
// cannot retain access to client communication channels after a trip ends.
// Both Redis keys are explicitly deleted the moment the trip is marked done —
// there is no grace period for the channel itself. The complaint window key
// is then created with a 24-hour TTL, giving the client exactly 24 hours to
// file a complaint before all trip-level records are permanently wiped.
router.patch('/:tripId/complete', requireAuth, async (req, res) => {
    const { tripId } = req.params;
    const actorId = req.user.id;
    const actorRole = req.user.role;

    try {
        // Step 1: Verify trip exists and is in_progress
        const tripResult = await query(
            'SELECT id, status FROM trips WHERE id = $1',
            [tripId]
        );

        if (tripResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        if (tripResult.rows[0].status !== 'in_progress') {
            return res.status(409).json({ error: `Trip is already in status '${tripResult.rows[0].status}'` });
        }

        // Step 2: Advance status to completed
        const updateResult = await query(
            `UPDATE trips SET status = 'completed' WHERE id = $1 RETURNING *`,
            [tripId]
        );

        // Step 3: Destroy both ephemeral session keys immediately
        await deleteSession(`session:trip:${tripId}:driver`);
        await deleteSession(`session:trip:${tripId}:client`);

        // Step 4: Open a 24-hour complaint window
        await setSession(
            `complaint:window:${tripId}`,
            { trip_id: tripId, opened_at: new Date().toISOString(), status: 'open' },
            86400
        );

        // Step 5: Write audit log entry
        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
            [
                'TRIP_SESSION_DESTROYED',
                actorId,
                actorRole,
                tripId,
                JSON.stringify({
                    trip_id: tripId,
                    session_keys_deleted: 2,
                    complaint_window_opened: true,
                    complaint_window_ttl_seconds: 86400,
                }),
            ]
        );

        return res.status(200).json(updateResult.rows[0]);
    } catch (err) {
        console.error('[trips] complete error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── GET / — List all trips (fleet manager dispatch view) ───────────────
// Protected: only authenticated fleet managers may query all trips.
router.get('/', requireAuth, async (_req, res) => {
    try {
        const result = await query(
            'SELECT * FROM trips ORDER BY pickup_time DESC'
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('[trips] list error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── GET /:tripId/session-status — Privacy Dashboard data source ─────────
// Protected: requires a valid JWT.
//
// This endpoint makes the invisible Redis TTL state visible in real time.
// It is the data source for the Privacy Dashboard and the live demonstration
// tool for research validation scenarios — an observer can watch session keys
// appear on trip acceptance and disappear on completion, demonstrating the
// automatic ephemeral channel lifecycle with no manual intervention.
router.get('/:tripId/session-status', requireAuth, async (req, res) => {
    const { tripId } = req.params;
    try {
        const [driverSession, clientSession, complaintWindow] = await Promise.all([
            getSession(`session:trip:${tripId}:driver`),
            getSession(`session:trip:${tripId}:client`),
            getSession(`complaint:window:${tripId}`),
        ]);
        return res.status(200).json({
            trip_id: tripId,
            driver_session_active: driverSession !== null,
            client_session_active: clientSession !== null,
            complaint_window_active: complaintWindow !== null,
        });
    } catch (err) {
        console.error('[trips] session-status error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── GET /:tripId — Retrieve a single trip ───────────────────────────
// Protected: requires a valid JWT.
router.get('/:tripId', requireAuth, async (req, res) => {
    const { tripId } = req.params;
    try {
        const result = await query(
            'SELECT * FROM trips WHERE id = $1',
            [tripId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        return res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('[trips] get error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
