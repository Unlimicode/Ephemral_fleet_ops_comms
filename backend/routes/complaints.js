import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireClientAuth } from '../middleware/clientAuth.js';
import pool from '../config/db.js';
import { getSession } from '../config/redisHelpers.js';
import redisClient from '../config/redis.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { getIo } from '../socket/io.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /:tripId - Public Complaint Lodgment 
// ─────────────────────────────────────────────────────────────────────────────
// The Redis window check (`complaint:window:{tripId}`) is the architectural 
// enforcement of the 24-hour complaint window. When the TTL expires, Redis 
// deletes the key automatically, and the endpoint physically cannot process 
// complaints after that point. This is purpose limitation implemented as a 
// technical constraint, not a policy. No database timestamp arithmetic is used.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:tripId', requireClientAuth, async (req, res) => {
    const { tripId } = req.params;
    const { category, description } = req.body;

    // 1. Verify cross-client access boundaries
    if (req.client.tripId !== tripId) {
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
                id AS complaint_id,
                trip_id,
                category,
                description,
                status,
                created_at
            FROM complaints
            ORDER BY created_at DESC
        `);

        return res.status(200).json(result.rows);

    } catch (err) {
        console.error('[complaints] GET / error:', err);
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
// GET /:complaintId/messages - Conditional Encryption Investigation Override
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURAL ACCOUNTABILITY GATEWAY:
// Message archive access is structurally restricted to 'under_investigation'
// status bindings. Every individual cryptologic native decryption access dynamically
// inserts a permanent `MESSAGE_ARCHIVE_ACCESSED` structural audit log natively preserving
// total accountability. A fleet manager physically cannot access messaging environments 
// simply because a complaint logically arose — they must structurally formalise investigations.
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
// PATCH /:complaintId/status - Structured Investigation Progress Metrics
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:complaintId/status', requireAuth(['fleet_manager']), async (req, res) => {
    const { complaintId } = req.params;
    const { status } = req.body;

    const validStatuses = ['under_investigation', 'resolved', 'escalated'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status format provided natively' });
    }

    try {
        const originalStatusQuery = await pool.query(`SELECT status FROM complaints WHERE id = $1`, [complaintId]);

        if (originalStatusQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Complaint not found natively' });
        }

        const oldStatus = originalStatusQuery.rows[0].status;

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

        return res.status(200).json(updatedResult.rows[0]);

    } catch (err) {
        console.error('[complaints] PATCH /:complaintId/status error:', err);
        return res.status(500).json({ error: 'Internal server error natively' });
    }
});

export default router;
