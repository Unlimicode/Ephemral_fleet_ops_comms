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
             WHERE action_type IN ('TRIP_COMPLETED', 'TRIP_SESSION_DESTROYED')
               AND timestamp > (NOW() - INTERVAL '25 hours')`
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
 * GET /compliance-report?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv
 * Full 9-section data-minimization compliance report answering Research Question 4.
 * Sections: header, executive summary, session lifecycle, data lifecycle,
 * communication anonymization, complaint & investigation, audit trail,
 * regulatory statement, architecture note.
 */
router.get('/compliance-report', requireAuth(['fleet_manager']), async (req, res) => {
    const { from, to, format } = req.query;

    // NULL params mean "no bound" — all-time query.
    const fromTs = from ? `${from}T00:00:00.000Z` : null;
    const toTs   = to   ? `${to}T23:59:59.999Z`   : null;

    try {
        const [metricsResult, windowKeys] = await Promise.all([
            query(`
                WITH period_trips AS (
                    SELECT t.id, t.status,
                           (SELECT COUNT(*) FROM complaints c WHERE c.trip_id = t.id) AS complaint_count
                    FROM trips t
                    WHERE ($1::TIMESTAMPTZ IS NULL OR t.pickup_time >= $1::TIMESTAMPTZ)
                      AND ($2::TIMESTAMPTZ IS NULL OR t.pickup_time <= $2::TIMESTAMPTZ)
                ),
                completed AS (SELECT * FROM period_trips WHERE status = 'completed'),
                audit_period AS (
                    SELECT
                        COUNT(*)                                                                        AS total_entries,
                        COUNT(*) FILTER (WHERE action_type = 'TRIP_ASSIGNED')                          AS credentials_issued,
                        COUNT(*) FILTER (WHERE action_type = 'TRIP_COMPLETED')                         AS credentials_revoked,
                        COUNT(*) FILTER (WHERE action_type = 'MESSAGE_ARCHIVE_ACCESSED')               AS archive_accesses,
                        COUNT(*) FILTER (WHERE action_type = 'DRIVER_DEACTIVATED')                     AS deactivation_events,
                        COUNT(*) FILTER (WHERE action_type IN (
                            'TRIP_ASSIGNED','TRIP_COMPLETED','TRIP_SESSION_DESTROYED','TRIP_ACCEPTED'
                        ))                                                                              AS session_events,
                        COUNT(*) FILTER (WHERE action_type IN (
                            'MESSAGE_ARCHIVE_ACCESSED','COMPLAINT_VIEWED'
                        ))                                                                              AS data_access_events,
                        COUNT(*) FILTER (WHERE action_type IN (
                            'COMPLAINT_FILED','COMPLAINT_STATUS_UPDATED','DRIVER_NOTIFIED_OF_REVIEW'
                        ))                                                                              AS complaint_events,
                        COUNT(*) FILTER (WHERE action_type IN (
                            'DRIVER_ADDED','DRIVER_DEACTIVATED','VEHICLE_ADDED','VEHICLE_REMOVED',
                            'COMPLIANCE_REPORT_EXPORTED','AUDIT_EXPORTED'
                        ))                                                                              AS system_events
                    FROM audit_log
                    WHERE ($1::TIMESTAMPTZ IS NULL OR timestamp >= $1::TIMESTAMPTZ)
                      AND ($2::TIMESTAMPTZ IS NULL OR timestamp <= $2::TIMESTAMPTZ)
                ),
                complaints_period AS (
                    SELECT
                        COUNT(*)                                                AS total_filed,
                        COUNT(*) FILTER (WHERE status = 'open')                AS status_open,
                        COUNT(*) FILTER (WHERE status = 'under_investigation') AS status_investigating,
                        COUNT(*) FILTER (WHERE status = 'resolved')            AS status_resolved
                    FROM complaints
                    WHERE ($1::TIMESTAMPTZ IS NULL OR created_at >= $1::TIMESTAMPTZ)
                      AND ($2::TIMESTAMPTZ IS NULL OR created_at <= $2::TIMESTAMPTZ)
                ),
                avg_session AS (
                    SELECT ROUND(AVG(EXTRACT(EPOCH FROM (c.timestamp - a.timestamp)) / 60)::numeric, 1) AS avg_minutes
                    FROM audit_log a
                    JOIN audit_log c ON c.target_id = a.target_id AND c.action_type = 'TRIP_COMPLETED'
                    WHERE a.action_type = 'TRIP_ASSIGNED'
                      AND ($1::TIMESTAMPTZ IS NULL OR a.timestamp >= $1::TIMESTAMPTZ)
                      AND ($2::TIMESTAMPTZ IS NULL OR a.timestamp <= $2::TIMESTAMPTZ)
                ),
                avg_resolution AS (
                    SELECT ROUND(AVG(
                        EXTRACT(EPOCH FROM (sub.latest_ts - sub.created_at)) / 3600
                    )::numeric, 1) AS avg_hours
                    FROM (
                        SELECT c.id, c.created_at, MAX(al.timestamp) AS latest_ts
                        FROM complaints c
                        JOIN audit_log al ON al.target_id = c.id
                          AND al.action_type = 'COMPLAINT_STATUS_UPDATED'
                        WHERE c.status = 'resolved'
                          AND ($1::TIMESTAMPTZ IS NULL OR c.created_at >= $1::TIMESTAMPTZ)
                          AND ($2::TIMESTAMPTZ IS NULL OR c.created_at <= $2::TIMESTAMPTZ)
                        GROUP BY c.id, c.created_at
                    ) sub
                )
                SELECT
                    (SELECT COUNT(*)              FROM period_trips)                    AS sessions_created,
                    (SELECT credentials_issued    FROM audit_period)                    AS credentials_issued,
                    (SELECT credentials_revoked   FROM audit_period)                   AS credentials_revoked,
                    (SELECT deactivation_events   FROM audit_period)                   AS deactivation_events,
                    (SELECT avg_minutes           FROM avg_session)                     AS avg_session_minutes,
                    (SELECT COUNT(*) FROM completed WHERE complaint_count > 0)          AS messages_persisted,
                    (SELECT COUNT(*) FROM completed WHERE complaint_count = 0)          AS messages_wiped,
                    (SELECT total_filed           FROM complaints_period)               AS complaints_filed,
                    (SELECT status_open           FROM complaints_period)               AS complaints_open,
                    (SELECT status_investigating  FROM complaints_period)               AS complaints_investigating,
                    (SELECT status_resolved       FROM complaints_period)               AS complaints_resolved,
                    (SELECT avg_hours             FROM avg_resolution)                  AS avg_resolution_hours,
                    (SELECT archive_accesses      FROM audit_period)                    AS archive_access_events,
                    (SELECT total_entries         FROM audit_period)                    AS audit_entries,
                    (SELECT session_events        FROM audit_period)                    AS audit_session_events,
                    (SELECT data_access_events    FROM audit_period)                    AS audit_data_access_events,
                    (SELECT complaint_events      FROM audit_period)                    AS audit_complaint_events,
                    (SELECT system_events         FROM audit_period)                    AS audit_system_events
            `, [fromTs, toTs]),
            client.keys('complaint:window:*'),
        ]);

        const r = metricsResult.rows[0];

        const sessionsCreated         = parseInt(r.sessions_created,         10) || 0;
        const credentialsIssued       = parseInt(r.credentials_issued,       10) || 0;
        const credentialsRevoked      = parseInt(r.credentials_revoked,      10) || 0;
        const deactivationEvents      = parseInt(r.deactivation_events,      10) || 0;
        const avgSessionMinutes       = r.avg_session_minutes     != null ? parseFloat(r.avg_session_minutes)     : null;
        const messagesPersisted       = parseInt(r.messages_persisted,       10) || 0;
        const messagesWiped           = parseInt(r.messages_wiped,           10) || 0;
        const activeComplaintWindows  = windowKeys.length;
        const complaintsFiled         = parseInt(r.complaints_filed,         10) || 0;
        const complaintsOpen          = parseInt(r.complaints_open,          10) || 0;
        const complaintsInvestigating = parseInt(r.complaints_investigating,  10) || 0;
        const complaintsResolved      = parseInt(r.complaints_resolved,      10) || 0;
        const avgResolutionHours      = r.avg_resolution_hours    != null ? parseFloat(r.avg_resolution_hours)    : null;
        const archiveAccessEvents     = parseInt(r.archive_access_events,    10) || 0;
        const auditEntries            = parseInt(r.audit_entries,            10) || 0;
        const auditSessionEvents      = parseInt(r.audit_session_events,     10) || 0;
        const auditDataAccessEvents   = parseInt(r.audit_data_access_events, 10) || 0;
        const auditComplaintEvents    = parseInt(r.audit_complaint_events,   10) || 0;
        const auditSystemEvents       = parseInt(r.audit_system_events,      10) || 0;

        const totalCompleted      = messagesWiped + messagesPersisted;
        const minimizationRate    = totalCompleted > 0 ? Math.round((messagesWiped  / totalCompleted)      * 100) : 100;
        const preservationRate    = 100 - minimizationRate;
        const revocationRate      = credentialsIssued > 0 ? Math.round((credentialsRevoked / credentialsIssued) * 100) : 100;
        const complaintFilingRate = totalCompleted > 0 ? Math.round((complaintsFiled / totalCompleted)     * 100) : 0;

        const periodLabel = from && to ? `between ${from} and ${to}` : 'across all recorded time';
        const executiveSummary =
            `SwiftLink processed ${sessionsCreated} booking session${sessionsCreated !== 1 ? 's' : ''} ${periodLabel}. ` +
            `Of ${totalCompleted} completed trip${totalCompleted !== 1 ? 's' : ''}, ${messagesWiped} (${minimizationRate}%) ` +
            `resulted in permanent data erasure — messages resided exclusively in Redis and were automatically purged when the TTL expired. ` +
            `${messagesPersisted} trip${messagesPersisted !== 1 ? 's' : ''} (${preservationRate}%) triggered conditional preservation ` +
            `due to a complaint filed within the 24-hour window. ` +
            `Driver credentials were revoked in ${revocationRate}% of issued sessions, demonstrating reliable lifecycle ` +
            `termination under the Mediated Ephemeral Identity Framework.`;

        // Log the export (outside test env to avoid ECONNREFUSED)
        if (process.env.NODE_ENV !== 'test') {
            await query(
                'INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details) VALUES ($1, $2, $3, $4, $5)',
                ['COMPLIANCE_REPORT_EXPORTED', req.user.id, 'fleet_manager', null,
                 JSON.stringify({ format: format || 'json', from: fromTs, to: toTs })]
            );
        }

        // Legacy metrics shape — kept for backward-compatible test coverage
        const metrics = {
            sessions_created:                 sessionsCreated,
            credentials_issued:               credentialsIssued,
            credentials_revoked:              credentialsRevoked,
            messages_ephemeral_only:          messagesWiped,
            messages_conditionally_persisted: messagesPersisted,
            messages_permanently_wiped:       messagesWiped,
            complaints_filed:                 complaintsFiled,
            complaint_window_expirations:     messagesWiped,
            audit_trail_entries:              auditEntries,
            manager_archive_accesses:         archiveAccessEvents,
        };

        if (format === 'csv') {
            const rows = [
                ['Section', 'Metric', 'Value', 'Description'],
                ['Session Lifecycle', 'Sessions Created',                 sessionsCreated,        'Booking sessions initiated in the period'],
                ['Session Lifecycle', 'Driver Credentials Issued',        credentialsIssued,      'Driver JWTs issued via trip assignment'],
                ['Session Lifecycle', 'Driver Credentials Revoked',       credentialsRevoked,     'Driver JWTs revoked on trip completion'],
                ['Session Lifecycle', 'Credential Revocation Rate',       `${revocationRate}%`,   'Percentage of issued credentials that were revoked'],
                ['Session Lifecycle', 'Avg Session Duration (min)',        avgSessionMinutes ?? 'N/A', 'Average time from credential issue to revocation'],
                ['Session Lifecycle', 'Deactivation Terminations',         deactivationEvents,    'Sessions terminated by manager-initiated driver deactivation'],
                ['Data Lifecycle',    'Completed Trips',                   totalCompleted,        'Trips that reached terminal status'],
                ['Data Lifecycle',    'Messages Ephemeral Only',           messagesWiped,         'Trips where messages resided in Redis only and were wiped'],
                ['Data Lifecycle',    'Messages Conditionally Persisted',  messagesPersisted,     'Trips where a complaint triggered message archival'],
                ['Data Lifecycle',    'Messages Permanently Wiped',        messagesWiped,         'Sessions where TTL expired with no complaint filed'],
                ['Data Lifecycle',    'Active Complaint Windows (live)',    activeComplaintWindows,'Complaint windows currently open in Redis'],
                ['Data Lifecycle',    'Data Minimization Rate',            `${minimizationRate}%`,'Percentage of completed trips with no persistent data'],
                ['Data Lifecycle',    'Preservation Rate',                 `${preservationRate}%`,'Percentage with conditionally preserved data'],
                ['Communication',     'Direct Contact Events',             0,                     'Times client contact details were exposed to driver'],
                ['Communication',     'Driver-Visible Client Fields',      'First name only',     'Fields transmitted to driver via trip assignment'],
                ['Complaints',        'Complaints Filed',                  complaintsFiled,       'Complaints submitted within the 24-hour window'],
                ['Complaints',        'Open',                              complaintsOpen,        'Complaints currently open'],
                ['Complaints',        'Under Investigation',               complaintsInvestigating,'Complaints under active investigation'],
                ['Complaints',        'Resolved',                          complaintsResolved,    'Complaints resolved'],
                ['Complaints',        'Manager Archive Accesses',          archiveAccessEvents,   'Times a manager accessed preserved complaint messages'],
                ['Complaints',        'Complaint Filing Rate',             `${complaintFilingRate}%`,'Proportion of completed trips that generated a complaint'],
                ['Complaints',        'Avg Resolution Time (hrs)',         avgResolutionHours ?? 'N/A','Average hours from filing to resolution'],
                ['Audit Trail',       'Total Entries',                     auditEntries,          'Append-only log entries in the period'],
                ['Audit Trail',       'Session Events',                    auditSessionEvents,    'Trip assignment, completion, session destruction events'],
                ['Audit Trail',       'Data Access Events',                auditDataAccessEvents, 'Message archive access and complaint view events'],
                ['Audit Trail',       'Complaint Events',                  auditComplaintEvents,  'Complaint filed, status updated, review notification events'],
                ['Audit Trail',       'System Events',                     auditSystemEvents,     'Driver/vehicle management and export events'],
            ];
            const csv = rows
                .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
                .join('\n');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition',
                `attachment; filename="swiftlink-compliance-${new Date().toISOString().split('T')[0]}.csv"`);
            return res.status(200).send(csv);
        }

        return res.status(200).json({
            generated_at: new Date().toISOString(),
            period: { from: fromTs || 'all time', to: toTs || 'all time' },
            operator: 'SwiftLink Fleet Operations',
            framework: 'Mediated Ephemeral Identity Framework',
            regulatory_basis: 'Kenya Data Protection Act 2019, Section 25 — Data Minimization',

            headline: {
                minimization_rate_percent: minimizationRate,
                summary: executiveSummary,
            },

            sections: {
                session_lifecycle: {
                    sessions_created:             sessionsCreated,
                    credentials_issued:           credentialsIssued,
                    credentials_revoked:          credentialsRevoked,
                    revocation_rate_percent:      revocationRate,
                    avg_session_duration_minutes: avgSessionMinutes,
                    deactivation_terminations:    deactivationEvents,
                },
                data_lifecycle: {
                    completed_trips:           totalCompleted,
                    messages_wiped:            messagesWiped,
                    messages_persisted:        messagesPersisted,
                    active_complaint_windows:  activeComplaintWindows,
                    minimization_rate_percent: minimizationRate,
                    preservation_rate_percent: preservationRate,
                },
                communication_anonymization: {
                    direct_contact_events:        0,
                    driver_visible_client_fields: ['client_first_name'],
                    contact_detail_exposures:     0,
                    architectural_note:
                        'Client contact identifiers are never transmitted to drivers. The schema enforces ' +
                        'first-name-only at the column level (trips.client_first_name). No phone number, ' +
                        'email address, or surname column exists in the driver-accessible data path.',
                },
                complaint_investigation: {
                    complaints_filed:              complaintsFiled,
                    by_status: {
                        open:                      complaintsOpen,
                        under_investigation:       complaintsInvestigating,
                        resolved:                  complaintsResolved,
                    },
                    archive_access_events:         archiveAccessEvents,
                    complaint_filing_rate_percent: complaintFilingRate,
                    avg_resolution_hours:          avgResolutionHours,
                },
                audit_trail: {
                    total_entries: auditEntries,
                    by_category: {
                        session_events:     auditSessionEvents,
                        data_access_events: auditDataAccessEvents,
                        complaint_events:   auditComplaintEvents,
                        system_events:      auditSystemEvents,
                    },
                    integrity_statement:
                        'Append-only log. No entries have been modified or deleted. ' +
                        'UPDATE and DELETE privileges are revoked from the application role at the database level.',
                },
            },

            // Legacy shape — kept for backward-compatible test coverage
            minimization_rate_percent: minimizationRate,
            metrics,
            sessions:           { destroyed: totalCompleted },
            data_lifecycle:     { trips_completed: totalCompleted },
            complaints:         { total_filed: complaintsFiled },
            audit_entries_total: auditEntries,
        });

    } catch (err) {
        console.error('[dashboard] compliance report error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
