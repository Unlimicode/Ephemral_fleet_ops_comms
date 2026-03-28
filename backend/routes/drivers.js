// ─────────────────────────────────────────────────────────────────────────────
// Drivers Router — Authentication and Session Management
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { setSession, getSession } from '../config/redisHelpers.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── POST /auth/login — Driver Login ──────────────────────────────────────────
// Authenticates a driver via work_email and password.
// Checks active_status to ensure revoked drivers cannot access the system.
// Returns a signed JWT bearing the 'driver' role.
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await query(
            'SELECT id, full_name, work_email, password_hash, active_status FROM drivers WHERE work_email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const driver = result.rows[0];

        // ── Active Status Check ──────────────────────────────────────────────────
        // Critical protection layer blocking terminated employees
        if (!driver.active_status) {
            return res.status(401).json({ error: 'Account deactivated' });
        }

        const isMatch = await bcrypt.compare(password, driver.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT with explicitly declared role mapping to RBAC guards
        const token = jwt.sign(
            { id: driver.id, role: 'driver' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        await setSession(`driver:availability:${driver.id}`, { status: 'available', updated_at: new Date().toISOString(), token });

        return res.status(200).json({
            token,
            user: {
                id: driver.id,
                full_name: driver.full_name,
                email: driver.work_email
            }
        });
    } catch (err) {
        console.error('[drivers] login error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── POST /auth/logout — Driver Logout ────────────────────────────────────────
// Extracts the Bearer token, decodes its remaining lifetime, and adds it to
// the Redis blocklist. The requireAuth middleware checks this list on every
// request, neutralizing the token even if it hasn't cryptographically expired.
router.post('/auth/logout', async (req, res) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(400).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
            const now = Math.floor(Date.now() / 1000);
            const ttl = decoded.exp - now;

            if (ttl > 0) {
                // Drop token into blocklist specifically for its remaining valid cryptographic window
                await setSession(`blocklist:${token}`, true, ttl);
            }

            if (decoded.id) {
                await setSession(`driver:availability:${decoded.id}`, { status: 'offline', updated_at: new Date().toISOString() });
            }
        }
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
        console.error('[drivers] logout error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── GET /availability — Fleet Manager Real-Time Dashboard ────────────────────
// This provides the fleet manager a real-time dispatch view without storing
// availability state in PostgreSQL — it's operational state that belongs in
// Redis, not permanent data.
router.get('/availability', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const result = await query(
            'SELECT id AS driver_id, full_name FROM drivers WHERE active_status = true'
        );

        const driversWithStatus = await Promise.all(
            result.rows.map(async (driver) => {
                const sessionData = await getSession(`driver:availability:${driver.driver_id}`);
                return {
                    driver_id: driver.driver_id,
                    full_name: driver.full_name,
                    status: sessionData && sessionData.status ? sessionData.status : 'offline'
                };
            })
        );

        return res.status(200).json(driversWithStatus);
    } catch (err) {
        console.error('[drivers] availability error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── GET /notifications — Driver notification history ──────────────────────────
router.get('/notifications', requireAuth(['driver']), async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM driver_notifications WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
        );
        return res.status(200).json({ notifications: result.rows });
    } catch (err) {
        console.error('[drivers] notifications error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /notifications/:notificationId/read — Mark notification as read ─────
router.patch('/notifications/:notificationId/read', requireAuth(['driver']), async (req, res) => {
    const { notificationId } = req.params;
    try {
        await query(
            'UPDATE driver_notifications SET read = true WHERE id = $1 AND driver_id = $2',
            [notificationId, req.user.id]
        );
        return res.status(200).json({ message: 'Marked as read' });
    } catch (err) {
        console.error('[drivers] mark-read error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
