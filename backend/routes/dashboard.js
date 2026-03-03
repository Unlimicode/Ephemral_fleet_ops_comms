import express from 'express';
import { query } from '../config/db.js';
import client from '../config/redis.js';
import { getTTL } from '../config/redisHelpers.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /trips/:tripId
 * Data source for the Privacy Dashboard UI.
 * Makes the invisible Redis TTL state for a specific trip visible in real time.
 */
router.get('/trips/:tripId', requireAuth(['fleet_manager']), async (req, res) => {
    const { tripId } = req.params;

    try {
        const tripCheck = await query(
            'SELECT id, pickup_location, destination, status FROM trips WHERE id = $1',
            [tripId]
        );

        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        const trip = tripCheck.rows[0];

        const driverKey = `session:trip:${tripId}:driver`;
        const clientKey = `session:trip:${tripId}:client`;
        const msgKey = `messages:trip:${tripId}`;
        const windowKey = `complaint:window:${tripId}`;

        const [driverTTL, clientTTL, msgTTL, windowTTL] = await Promise.all([
            getTTL(driverKey),
            getTTL(clientKey),
            getTTL(msgKey),
            getTTL(windowKey)
        ]);

        let messageCount = 0;
        if (msgTTL !== -2) {
            messageCount = await client.lLen(msgKey);
        }

        const complaintCheck = await query(
            'SELECT id FROM complaints WHERE trip_id = $1 LIMIT 1',
            [tripId]
        );

        const buildSessionState = (ttl) => ({
            active: ttl !== -2,
            ttl_seconds: ttl !== -2 ? ttl : null
        });

        const msgSessionState = buildSessionState(msgTTL);
        if (msgSessionState.active) {
            msgSessionState.message_count = messageCount;
        }

        return res.status(200).json({
            trip_id: trip.id,
            pickup_location: trip.pickup_location,
            destination: trip.destination,
            status: trip.status,
            sessions: {
                driver: buildSessionState(driverTTL),
                client: buildSessionState(clientTTL),
                message_buffer: msgSessionState,
                complaint_window: buildSessionState(windowTTL)
            },
            complaint_filed: complaintCheck.rows.length > 0
        });
    } catch (err) {
        console.error('[dashboard] trip details error:', err);
        return res.status(500).json({ error: 'Internal server error while fetching dashboard state' });
    }
});

/**
 * GET /overview
 * Data source for the Privacy Dashboard UI.
 * Returns a system-wide session summary of active identity lifetimes.
 */
router.get('/overview', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const activeTripsQuery = await query(
            `SELECT id, pickup_location, destination, status 
             FROM trips 
             WHERE status = 'in_progress' 
                OR (status = 'completed' AND pickup_time > NOW() - INTERVAL '25 hours')
             ORDER BY pickup_time DESC`
        );

        const trips = activeTripsQuery.rows;

        let active_driver_sessions = 0;
        let active_client_sessions = 0;
        let active_message_buffers = 0;
        let open_complaint_windows = 0;

        const mappedTrips = await Promise.all(trips.map(async (trip) => {
            const tripId = trip.id;
            const [driverTTL, clientTTL, msgTTL, windowTTL] = await Promise.all([
                getTTL(`session:trip:${tripId}:driver`),
                getTTL(`session:trip:${tripId}:client`),
                getTTL(`messages:trip:${tripId}`),
                getTTL(`complaint:window:${tripId}`)
            ]);

            const dActive = driverTTL !== -2;
            const cActive = clientTTL !== -2;
            const mActive = msgTTL !== -2;
            const wActive = windowTTL !== -2;

            if (dActive) active_driver_sessions++;
            if (cActive) active_client_sessions++;
            if (mActive) active_message_buffers++;
            if (wActive) open_complaint_windows++;

            const complaintCheck = await query(
                'SELECT id FROM complaints WHERE trip_id = $1 LIMIT 1',
                [tripId]
            );

            return {
                trip_id: tripId,
                status: trip.status,
                pickup_location: trip.pickup_location,
                destination: trip.destination,
                driver_session_active: dActive,
                client_session_active: cActive,
                complaint_window_active: wActive,
                complaint_filed: complaintCheck.rows.length > 0
            };
        }));

        const auditQuery = await query(
            `SELECT COUNT(*) as count 
             FROM audit_log 
             WHERE action_type = 'TRIP_SESSION_DESTROYED' 
               AND timestamp >= NOW() - INTERVAL '24 hours'`
        );

        return res.status(200).json({
            active_trips: trips.filter(t => t.status === 'in_progress').length,
            active_driver_sessions,
            active_client_sessions,
            active_message_buffers,
            open_complaint_windows,
            sessions_destroyed_today: parseInt(auditQuery.rows[0].count, 10),
            trips: mappedTrips
        });
    } catch (err) {
        console.error('[dashboard] overview error:', err);
        return res.status(500).json({ error: 'Internal server error while building dashboard overview' });
    }
});

export default router;
