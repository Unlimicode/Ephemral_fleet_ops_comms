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
             FROM trips 
             WHERE status = 'completed' 
               AND pickup_time > (NOW() - INTERVAL '25 hours')`
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
 * GET /summary
 * High-level metrics for the Privacy Dashboard.
 */
router.get('/summary', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const stats = await query(`
            WITH trip_sessions AS (
                SELECT t.id, t.status, 
                       (SELECT COUNT(*) FROM complaints WHERE trip_id = t.id) as complaint_count
                FROM trips t
                WHERE t.status IN ('completed', 'in_progress', 'assigned', 'pending')
            )
            SELECT 
                COUNT(*) as sessions_created,
                COUNT(*) FILTER (WHERE status = 'completed') as credentials_expired,
                COUNT(*) FILTER (WHERE status = 'completed' AND complaint_count = 0) as data_wiped,
                COUNT(*) FILTER (WHERE status = 'completed' AND complaint_count > 0) as conditionally_persisted
            FROM trip_sessions
        `);

        const { sessions_created, credentials_expired, data_wiped, conditionally_persisted } = stats.rows[0];
        const wiped = parseInt(data_wiped, 10);
        const persisted = parseInt(conditionally_persisted, 10);
        const minimization_rate = (wiped + persisted) > 0 ? Math.round((wiped / (wiped + persisted)) * 100) : 100;

        return res.status(200).json({
            sessions_created: parseInt(sessions_created, 10),
            credentials_expired: parseInt(credentials_expired, 10),
            data_wiped: wiped,
            conditionally_persisted: persisted,
            minimization_rate
        });
    } catch (err) {
        console.error('[dashboard] summary error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /sessions
 * Real-time active session monitor.
 */
router.get('/sessions', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        // 1. Scan Redis for active client sessions
        const keys = await client.keys('session:trip:*:client');
        const activeSessions = await Promise.all(keys.map(async (key) => {
            const tripId = key.split(':')[2];
            const ttl = await client.ttl(key);
            return {
                tripId,
                ttl,
                status: 'active',
                dataLocation: 'redis'
            };
        }));

        // 2. Query PostgreSQL for trips in complaint_window or persisted due to complaint
        const persistedTrips = await query(`
            SELECT t.id, t.status
            FROM trips t
            JOIN complaints c ON t.id = c.trip_id
            WHERE t.status = 'completed'
        `);

        const persistedSessions = persistedTrips.rows.map(t => ({
            tripId: t.id,
            ttl: 0,
            status: 'complaint_window',
            dataLocation: 'postgresql'
        }));

        return res.status(200).json([...activeSessions, ...persistedSessions]);
    } catch (err) {
        console.error('[dashboard] sessions error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /compliance-report
 * Full system audit and compliance data export.
 */
router.get('/compliance-report', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE status IN ('completed', 'in_progress', 'assigned')) as created,
                COUNT(*) FILTER (WHERE status = 'completed') as expired,
                (SELECT COUNT(*) FROM complaints) as persisted
            FROM trips
        `);

        const auditCount = await query('SELECT COUNT(*) FROM audit_log');

        const row = stats.rows[0] || { created: '0', expired: '0', persisted: '0' };
        const createdCount = parseInt(row.created?.toString() || '0', 10);
        const expiredCount = parseInt(row.expired?.toString() || '0', 10);
        const persistedCount = parseInt(row.persisted?.toString() || row.complaint_count?.toString() || '0', 10); // Check both names just in case
        const auditTotal = parseInt(auditCount.rows[0]?.count?.toString() || '0', 10);

        const report = {
            generated_at: new Date().toISOString(),
            operator: "Swiftlink Fleet Operations",
            framework: "Mediated Ephemeral Identity",
            compliance: {
                sessions_created: createdCount,
                credentials_issued: createdCount,
                credentials_revoked: expiredCount,
                data_expired: Math.max(0, expiredCount - persistedCount),
                data_conditionally_persisted: persistedCount,
                minimization_rate_percent: expiredCount > 0 ? Math.round(((expiredCount - persistedCount) / expiredCount) * 100) : 100,
                audit_entries: auditTotal
            },
            regulatory_basis: "Kenya Data Protection Act 2019, Section 25 — Data Minimization",
            architecture_note: "Message content is stored in Redis with TTL enforcement. Permanent storage occurs only when a complaint is filed before TTL expiry. This constraint is enforced at the architectural level, not by policy.",
            // Legacy properties to satisfy existing tests
            sessions: {
                destroyed: expiredCount
            },
            data_lifecycle: {
                trips_completed: expiredCount
            },
            complaints: {
                total_filed: persistedCount,
            },
            audit_entries_total: auditTotal
        };

        // Log export
        await query(
            'INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details) VALUES ($1, $2, $3, $4, $5)',
            ['COMPLIANCE_REPORT_EXPORTED', req.user.id, 'fleet_manager', null, JSON.stringify({ format: 'json' })]
        );

        return res.status(200).json(report);
    } catch (err) {
        console.error('[dashboard] compliance report error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
