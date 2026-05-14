// ─────────────────────────────────────────────────────────────────────────────
// Complaints Router — Complaint lifecycle and conditional message archive access.
//
// STATUS FLOW:
//
//   open ──manager-opens-investigation──▶ under_investigation ──resolve──▶ resolved
//     ▲                                          │
//     └──manager-reopens-from-investigation──────┘     (resolved is terminal)
//
//   open                  Client just filed it. Manager can see metadata only.
//   under_investigation   Manager has explicitly opened it. ONLY in this state
//                         can encrypted message archive be decrypted (gated by
//                         GET /:complaintId/messages) — every decrypt writes an
//                         audit_log entry (FR6 accountability).
//   resolved              Terminal. No transitions out — resolved complaints
//                         cannot be reopened (enforced at PATCH /:id/status).
//
// CONDITIONAL PERSISTENCE (FR5):
//   - The 24h complaint window is enforced by `complaint:window:{tripId}` in
//     Redis (created on trip complete, TTL 86400s). When the key expires, the
//     POST endpoint physically rejects the complaint — privacy is a structural
//     constraint, not a policy check.
//   - On complaint filing, the buffered Redis chat messages are AES-256-GCM
//     encrypted (utils/encryption.js) and moved into complaints.encrypted_message_archive.
//     The Redis copy is deleted immediately — no duplicate storage.
//   - If no complaint is filed within 24h, the Redis buffer self-expires and
//     the messages are gone forever. No nightly cleanup job needed.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireClientAuth } from '../middleware/clientAuth.js';
import pool from '../config/db.js';
import { getSession } from '../config/redisHelpers.js';
import redisClient from '../config/redis.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { getIo } from '../socket/io.js';
import { emitDashboardEvent } from '../socket/dashboardNamespace.js';
import { sendPushNotification } from '../utils/sendPushNotification.js';
import { sendComplaintStatusUpdate } from '../config/mailer.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [FR5] Conditional Persistence — complaint filing triggers message archive.
// [FR6] Complaint Investigation — complaint record created here, begins the
//       investigation lifecycle (open → under_investigation → resolved).
//
// POST /:tripId - Client Complaint Lodgment
// ─────────────────────────────────────────────────────────────────────────────
// The Redis window check (`complaint:window:{tripId}`) is the architectural
// enforcement of the 24-hour complaint window. When the TTL expires, Redis
// deletes the key automatically, and the endpoint physically cannot process
// complaints after that point. This is purpose limitation implemented as a
// TECHNICAL CONSTRAINT, not a policy. No database timestamp arithmetic is used.
// WHY: A policy saying "complaints must be filed within 24 hours" can be ignored
// or worked around. A Redis key that no longer exists cannot be checked successfully —
// the system is structurally incapable of accepting late complaints.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:tripId', requireClientAuth, async (req, res) => {
    const { tripId } = req.params;
    const { category, description } = req.body;

    // 1. Verify cross-client access boundaries
    if (req.client.trip_id !== tripId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    if (!category || !description) {
        return res.status(400).json({ error: 'Missing category or description fields' });
    }

    try {
        // 2. Enforce physical architectural bounds against Ephemeral tracking windows.
        const complaintWindow = await getSession(`complaint:window:${tripId}`);
        if (!complaintWindow) {
            return res.status(403).json({ error: 'Complaint window closed or trip invalid' });
        }

        // 3. Validate the underlying trip structure completed cleanly in PostgreSQL
        const tripCheck = await pool.query(
            "SELECT id FROM trips WHERE id = $1 AND status = 'completed'",
            [tripId]
        );

        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found or ineligible for complaints' });
        }

        // 4. Insert Feedback preserving Client Anonymity natively without extracting PII
        const insertReq = await pool.query(
            `INSERT INTO complaints (trip_id, category, description, status, encrypted_message_archive)
             VALUES ($1, $2, $3, 'open', NULL)
             RETURNING id, category, status, created_at`,
            [tripId, category, description]
        );

        const complaintId = insertReq.rows[0].id;

        // 5. Bind logical structures onto the global Postgres Audit timeline anonymously
        await pool.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                'COMPLAINT_FILED',
                tripId,         // Preserving anonymity, using trip boundary as actor
                'client',       // Structural role preservation
                complaintId,
                JSON.stringify({ category, trip_id: tripId })
            ]
        );

        // ─────────────────────────────────────────────────────────────────────────────
        // CONDITIONAL PERSISTENCE LOGIC
        // ─────────────────────────────────────────────────────────────────────────────
        const bufferKey = `messages:trip:${tripId}`;
        const rawBuffer = await redisClient.lRange(bufferKey, 0, -1);

        if (rawBuffer && rawBuffer.length > 0) {
            const parsedMessages = rawBuffer.map(msg => JSON.parse(msg));
            const stringifiedPayload = JSON.stringify(parsedMessages);
            const encryptedArchive = encrypt(stringifiedPayload);

            await pool.query(
                `UPDATE complaints SET encrypted_message_archive = $1 WHERE id = $2`,
                [encryptedArchive, complaintId]
            );

            // The Redis message buffer is deleted immediately after archiving — not 
            // left to expire. This is intentional: once messages are conditionally 
            // persisted to PostgreSQL, the Redis copy serves no purpose and its 
            // continued existence would be a data minimisation violation.
            await redisClient.del(bufferKey);

            await pool.query(
                `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    'MESSAGE_ARCHIVE_CREATED',
                    tripId,
                    'system',
                    complaintId,
                    JSON.stringify({
                        complaint_id: complaintId,
                        message_count: parsedMessages.length,
                        archived_at: new Date().toISOString()
                    })
                ]
            );
        }

        try {
            emitDashboardEvent('complaint_filed', { trip_id: tripId, complaint_id: complaintId, category });
        } catch (_) { }

        return res.status(201).json({
            message: 'Complaint filed successfully.',
            complaint_id: complaintId
        });

    } catch (err) {
        console.error('[complaints] POST / error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET / - Fleet Manager Aggregation Viewport
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.id AS complaint_id,
                c.trip_id,
                c.category,
                c.description,
                c.status,
                c.investigation_notes,
                c.created_at,
                t.client_corporate_email,
                t.pickup_location,
                t.destination,
                SUBSTRING(t.client_corporate_email FROM '@(.*)$') as organisation
            FROM complaints c
            JOIN trips t ON c.trip_id = t.id
            ORDER BY c.created_at DESC
        `);

        return res.status(200).json(result.rows);

    } catch (err) {
        console.error('[complaints] GET / error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /:tripId/status - Client-Facing Complaint Progress
// ─────────────────────────────────────────────────────────────────────────────
// Returns the current complaint status for a trip without exposing PII.
// Clients poll this endpoint every 30 seconds for live progress updates.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:tripId/status', requireClientAuth, async (req, res) => {
    const { tripId } = req.params;

    if (req.client.trip_id !== tripId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const result = await pool.query(
            `SELECT id AS complaint_id, status, category, created_at, investigation_notes
             FROM complaints WHERE trip_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [tripId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No complaint found for this trip' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('[complaints] GET /:tripId/status error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [FR6] Complaint Investigation — gated message archive access with audit trail.
//
// GET /:complaintId/messages - Message Archive Decryption
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURAL ACCOUNTABILITY GATEWAY:
// Message archive access is restricted to status = 'under_investigation' ONLY.
// A manager cannot access messages when status = 'open' or status = 'resolved'.
// They must first explicitly call PATCH /:id/status to advance the complaint —
// this is the auditable decision point required by FR6.
// Every decryption inserts a MESSAGE_ARCHIVE_ACCESSED audit_log entry, making
// the manager personally accountable for each access. This satisfies DPA 2019
// s.30 (accountability) and s.41 (audit trail requirements).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:complaintId/messages', requireAuth(['fleet_manager']), async (req, res) => {
    const { complaintId } = req.params;

    try {
        const result = await pool.query(
            `SELECT status, encrypted_message_archive FROM complaints WHERE id = $1`,
            [complaintId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const complaint = result.rows[0];

        // Ensure structural gating protects casual surveillance bounds natively
        if (complaint.status !== 'under_investigation') {
            return res.status(403).json({ error: 'Message archive only accessible during active investigation' });
        }

        // Empty bindings return safely logically structured parameters preserving states gracefully
        if (!complaint.encrypted_message_archive) {
            return res.status(200).json({ messages: [], note: 'No messages were exchanged during this trip' });
        }

        const rawPlaintext = decrypt(complaint.encrypted_message_archive);
        const messagesArray = JSON.parse(rawPlaintext);

        await pool.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                'MESSAGE_ARCHIVE_ACCESSED',
                req.user.id,
                'fleet_manager',
                complaintId,
                JSON.stringify({ accessed_at: new Date().toISOString() })
            ]
        );

        return res.status(200).json({ messages: messagesArray });

    } catch (err) {
        console.error('[complaints] GET /:complaintId/messages error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /:complaintId - Fleet Manager Explicit Detail Access Route
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:complaintId', requireAuth(['fleet_manager']), async (req, res) => {
    const { complaintId } = req.params;

    try {
        const result = await pool.query(
            `SELECT 
                c.id AS complaint_id, c.trip_id, c.category, c.description, c.status, c.created_at,
                row_to_json(t) AS trip_details
             FROM complaints c
             JOIN trips t ON c.trip_id = t.id
             WHERE c.id = $1`,
            [complaintId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        // 6. Explicitly insert native logging events preserving Fleet Manager accountability audits seamlessly
        await pool.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id)
             VALUES ($1, $2, $3, $4)`,
            ['COMPLAINT_VIEWED', req.user.id, 'fleet_manager', complaintId]
        );

        return res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error('[complaints] GET /:complaintId error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:complaintId/status - Structured Investigation Progress Metrics
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:complaintId/status', requireAuth(['fleet_manager']), async (req, res) => {
    const { complaintId } = req.params;
    const { status } = req.body;

    // Canonical status values — 'escalated' is not in the flow
    const validStatuses = ['open', 'under_investigation', 'resolved'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    try {
        const originalStatusQuery = await pool.query(`SELECT status FROM complaints WHERE id = $1`, [complaintId]);

        if (originalStatusQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const oldStatus = originalStatusQuery.rows[0].status;

        // resolved is a terminal state — no transitions out of it
        if (oldStatus === 'resolved') {
            return res.status(409).json({ error: 'Resolved complaints cannot be reopened' });
        }

        const updatedResult = await pool.query(
            `UPDATE complaints SET status = $1 WHERE id = $2 RETURNING id, trip_id, category, description, status, created_at`,
            [status, complaintId]
        );

        await pool.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                'COMPLAINT_STATUS_UPDATED',
                req.user.id,
                'fleet_manager',
                complaintId,
                JSON.stringify({
                    complaint_id: complaintId,
                    old_status: oldStatus,
                    new_status: status,
                    updated_by: req.user.id
                })
            ]
        );

        try {
            emitDashboardEvent('complaint_status_updated', { complaint_id: complaintId, new_status: status });
        } catch (_) { }

        // When a complaint enters investigation, notify the assigned driver.
        // The message body contains no complaint details or client information.
        if (status === 'under_investigation') {
            try {
                const tripRes = await pool.query(
                    'SELECT assigned_driver_id FROM trips WHERE id = $1',
                    [updatedResult.rows[0].trip_id]
                );
                if (tripRes.rows.length > 0 && tripRes.rows[0].assigned_driver_id) {
                    await sendPushNotification(tripRes.rows[0].assigned_driver_id, {
                        title: 'Trip Review In Progress',
                        body: 'A review has been opened for one of your recent trips.',
                        type: 'complaint_review',
                    });
                }
            } catch (err) {
                console.error('[complaints] Push notification failed on review open:', err.message);
            }
        }

        // Email notification to client on status change
        if (process.env.NODE_ENV !== 'test') {
            try {
                const tripEmail = await pool.query(
                    `SELECT t.client_corporate_email, c.investigation_notes
                     FROM trips t JOIN complaints c ON t.id = c.trip_id
                     WHERE c.id = $1`,
                    [complaintId]
                );
                if (tripEmail.rows.length > 0 && tripEmail.rows[0].client_corporate_email) {
                    await sendComplaintStatusUpdate(
                        tripEmail.rows[0].client_corporate_email,
                        complaintId,
                        status,
                        tripEmail.rows[0].investigation_notes
                    );
                }
            } catch (mailErr) {
                console.error('[complaints] Email notification failed:', mailErr.message);
            }
        }

        return res.status(200).json(updatedResult.rows[0]);

    } catch (err) {
        console.error('[complaints] PATCH /:complaintId/status error:', err);
        return res.status(500).json({ error: 'Internal server error natively' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:complaintId/notes - Investigation Documentation
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:complaintId/notes', requireAuth(['fleet_manager']), async (req, res) => {
    const { complaintId } = req.params;
    const { notes } = req.body;

    if (notes === undefined || typeof notes !== 'string' || !notes.trim()) {
        return res.status(400).json({ error: 'notes must be a non-empty string' });
    }

    try {
        await pool.query(
            `UPDATE complaints SET investigation_notes = $1 WHERE id = $2`,
            [notes, complaintId]
        );

        return res.status(200).json({ message: 'Investigation notes updated.' });
    } catch (err) {
        console.error('[complaints] PATCH /:complaintId/notes error:', err);
        return res.status(500).json({ error: 'Internal server error natively' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:complaintId/notify-driver - Explicit accountability trigger
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:complaintId/notify-driver', requireAuth(['fleet_manager']), async (req, res) => {
    const { complaintId } = req.params;

    try {
        const result = await pool.query(
            `SELECT c.trip_id, t.assigned_driver_id 
             FROM complaints c
             JOIN trips t ON c.trip_id = t.id
             WHERE c.id = $1`,
            [complaintId]
        );

        if (result.rows.length === 0 || !result.rows[0].assigned_driver_id) {
            return res.status(404).json({ error: 'Complaint or assigned driver not found' });
        }

        const driverId = result.rows[0].assigned_driver_id;

        await sendPushNotification(driverId, {
            title: 'Trip Review Update',
            body: 'A fleet manager is reviewing a recent trip under investigation.',
            type: 'complaint_review',
        });

        await pool.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['DRIVER_NOTIFIED_OF_REVIEW', req.user.id, 'fleet_manager', driverId, { complaint_id: complaintId }]
        );

        return res.status(200).json({ message: 'Driver notified successfully.' });
    } catch (err) {
        console.error('[complaints] POST /notify-driver error:', err);
        return res.status(500).json({ error: 'Internal server error natively' });
    }
});

export default router;
