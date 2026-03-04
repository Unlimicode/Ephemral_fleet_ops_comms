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

/**
 * GET /audit
 * Exposes the append-only audit trail for fleet manager review.
 * Every sensitive action in the system — session creation, session
 * destruction, message archive access, complaint filing — is recorded
 * here and cannot be modified or deleted.
 */
router.get('/audit', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const { action_type, actor_role, limit: queryLimit, offset: queryOffset } = req.query;

        let limit = parseInt(queryLimit, 10) || 50;
        if (limit > 200) limit = 200;
        const offset = parseInt(queryOffset, 10) || 0;

        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (action_type) {
            conditions.push(`action_type = $${paramIndex++}`);
            params.push(action_type);
        }

        if (actor_role) {
            conditions.push(`actor_role = $${paramIndex++}`);
            params.push(actor_role);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countRes = await query(`SELECT COUNT(*) FROM audit_log ${whereClause}`, params);
        const total_count = parseInt(countRes.rows[0].count, 10);

        const dataRes = await query(
            `SELECT * FROM audit_log ${whereClause} ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            [...params, limit, offset]
        );

        return res.status(200).json({
            entries: dataRes.rows,
            total_count,
            limit,
            offset
        });

    } catch (err) {
        console.error('[dashboard] audit error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /compliance-report
 * This report is the quantitative answer to Research Question 4 — it produces
 * a documented record of data minimisation in practice that can be presented
 * to regulators and used as evidence in the research validation chapter.
 */
router.get('/compliance-report', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const auditActionQuery = await query(`SELECT action_type, COUNT(*) FROM audit_log GROUP BY action_type`);
        const complaintStatusQuery = await query(`SELECT status, COUNT(*) FROM complaints GROUP BY status`);
        const tripStatusQuery = await query(`SELECT status, COUNT(*) FROM trips GROUP BY status`);

        const expiredNaturallyQuery = await query(`
            SELECT COUNT(t.id) 
            FROM trips t 
            LEFT JOIN complaints c ON t.id = c.trip_id 
            WHERE t.status = 'completed' AND c.id IS NULL
        `);

        // Convert db grouped rows into hash maps natively
        const auditCounts = {};
        auditActionQuery.rows.forEach(r => { auditCounts[r.action_type] = parseInt(r.count, 10); });

        const complaintCounts = {};
        complaintStatusQuery.rows.forEach(r => { complaintCounts[r.status] = parseInt(r.count, 10); });

        const tripCounts = {};
        tripStatusQuery.rows.forEach(r => { tripCounts[r.status] = parseInt(r.count, 10); });

        const data_expired_naturally = parseInt(expiredNaturallyQuery.rows[0].count, 10);

        // Aggregate session metrics logically across the two parallel APIs (trips / driverTrips) natively
        const sessionsCreated = (auditCounts['TRIP_SESSION_CREATED'] || 0) + (auditCounts['TRIP_ACCEPTED'] || 0);
        const sessionsDestroyed = (auditCounts['TRIP_SESSION_DESTROYED'] || 0) + (auditCounts['TRIP_COMPLETED'] || 0);

        // Calculate currently active sessions structurally protecting against negative bounds logically
        const currentlyActive = Math.max(0, sessionsCreated - sessionsDestroyed);

        // Total complaints natively calculated 
        const totalComplaints = Object.values(complaintCounts).reduce((a, b) => a + b, 0);

        // Total audit entries natively globally scaled
        const totalAuditEntries = Object.values(auditCounts).reduce((a, b) => a + b, 0);

        return res.status(200).json({
            generated_at: new Date().toISOString(),
            sessions: {
                created: sessionsCreated,
                destroyed: sessionsDestroyed,
                currently_active: currentlyActive
            },
            data_lifecycle: {
                trips_completed: tripCounts['completed'] || 0,
                message_archives_created: auditCounts['MESSAGE_ARCHIVE_CREATED'] || 0,
                message_archives_accessed: auditCounts['MESSAGE_ARCHIVE_ACCESSED'] || 0,
                data_expired_naturally: data_expired_naturally
            },
            complaints: {
                total_filed: totalComplaints,
                pending: (complaintCounts['open'] || 0) + (complaintCounts['pending'] || 0),
                under_investigation: complaintCounts['under_investigation'] || 0,
                resolved: complaintCounts['resolved'] || 0,
                escalated: complaintCounts['escalated'] || 0
            },
            audit_entries_total: totalAuditEntries
        });

    } catch (err) {
        console.error('[dashboard] compliance report error:', err);
        return res.status(500).json({ error: 'Internal server error while formulating compliance report natively' });
    }
});

export default router;
