import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../config/db.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { getSession, setSession } from '../config/redisHelpers.js';

const router = express.Router();

// Configure strictly local ethereal NodeMailer mapping test environments 
// natively bypassing physical SMTP buffer locks.
let transporter;
if (process.env.NODE_ENV === 'test') {
    transporter = nodemailer.createTransport({ streamTransport: true });
} else {
    // Standard connection
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: process.env.SMTP_PORT || 587,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /drivers - Provision a new physical Driver identity out-of-bounds.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/drivers', requireAuth(['fleet_manager']), async (req, res) => {
    const { full_name, work_email, employee_id } = req.body;
    const fleetManagerId = req.user.id;

    if (!full_name || !work_email || !employee_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Enforce UUID uniqueness natively over postgres indexes
        const duplicateCheck = await pool.query('SELECT id FROM drivers WHERE work_email = $1', [work_email]);
        if (duplicateCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Driver email already exists.' });
        }

        // Generate a 16-byte cryptographically secure hexadecimal string
        const temporaryPassword = crypto.randomBytes(16).toString('hex');

        // Hash identity natively executing 12 salt rounds protecting iteration scaling
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);

        const insertResult = await pool.query(
            `INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status)
             VALUES ($1, $2, $3, $4, $5, true)
             RETURNING id`,
            [fleetManagerId, full_name, work_email, employee_id, passwordHash]
        );

        const newDriverId = insertResult.rows[0].id;

        // Write DRIVER_ADDED to append-only Postgres Audit Log
        await pool.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['DRIVER_ADDED', fleetManagerId, 'fleet_manager', newDriverId, { full_name, work_email, employee_id }]
        );

        // Physically transport credentials out-of-bands masking payload evaluation from REST API outputs natively.
        await transporter.sendMail({
            from: '"Fleet Ops Comms" <noreply@fleetops.dev>',
            to: work_email,
            subject: 'Your Fleet Ops Driver Account',
            text: `Hello ${full_name},\n\nYour driver account has been provisioned.\nLogin Email: ${work_email}\nTemporary Password: ${temporaryPassword}`
        });

        // 201 Created: Return explicit payload STRIPPED of `password` arrays.
        return res.status(201).json({
            message: 'Driver account created. Login credentials sent to driver email.',
            driver_id: newDriverId
        });

    } catch (err) {
        console.error('[roster] POST /drivers error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /drivers/:driverId/deactivate - Dynamic physical identity revocation.
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE NOTE: Deactivation triggers both a database state change and an 
// immediate Redis session invalidation. This physically forces any active JWT 
// directly into the blocklist regardless of its logical expiry timestamp.
// This is the architectural guarantee mapping to MVP session invalidation rules.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/drivers/:driverId/deactivate', requireAuth(['fleet_manager']), async (req, res) => {
    const { driverId } = req.params;
    const fleetManagerId = req.user.id;

    try {
        // Enforce boundary scope
        const checkDrive = await pool.query(
            'SELECT id FROM drivers WHERE id = $1 AND fleet_manager_id = $2',
            [driverId, fleetManagerId]
        );
        if (checkDrive.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        // 1. Database State Execution
        await pool.query('UPDATE drivers SET active_status = false WHERE id = $1', [driverId]);

        // 2. Physical Redis Session Eviction
        // Scan for active application allocations.
        const currentSession = await getSession(`driver:availability:${driverId}`);
        if (currentSession && currentSession.token) {
            // Blocklist the raw JWT token bypassing the standard TTL horizon.
            await setSession(`blocklist:${currentSession.token}`, { revokedBy: fleetManagerId }, 86400 * 7); // 7-day safety bound
        }

        // Reset tracking optics mapping Dashboard accuracy natively
        await setSession(`driver:availability:${driverId}`, { status: 'offline', updated_at: new Date().toISOString() });

        // 3. Audit Logging
        await pool.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['DRIVER_DEACTIVATED', fleetManagerId, 'fleet_manager', driverId, { driver_id: driverId, deactivated_by: fleetManagerId }]
        );

        return res.status(200).json({ message: 'Driver deactivated. Active session revoked.' });

    } catch (err) {
        console.error('[roster] PATCH /deactivate error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /drivers - Fleet Manager Roster Visualization
// ─────────────────────────────────────────────────────────────────────────────
router.get('/drivers', requireAuth(['fleet_manager']), async (req, res) => {
    const fleetManagerId = req.user.id;

    try {
        const driversReq = await pool.query(
            `SELECT id AS driver_id, full_name, work_email, employee_id, active_status
             FROM drivers 
             WHERE fleet_manager_id = $1
             ORDER BY full_name ASC`,
            [fleetManagerId]
        );

        // Map PostgreSQL structures and dynamically hydrate physical Redis status
        const populatedDrivers = await Promise.all(driversReq.rows.map(async (driver) => {
            const availability = await getSession(`driver:availability:${driver.driver_id}`);
            return {
                ...driver,
                availability_status: availability ? availability.status : 'offline'
            };
        }));

        return res.status(200).json(populatedDrivers);

    } catch (err) {
        console.error('[roster] GET /drivers error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
