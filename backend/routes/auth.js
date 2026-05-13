// ─────────────────────────────────────────────────────────────────────────────
// Auth Router — Fleet Manager Login / Logout
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { setSession } from '../config/redisHelpers.js';

const router = Router();

// ── POST /login ─────────────────────────────────────────────────────────────
// [FR4] Ephemeral Credential Management — JWT issuance for fleet managers.
// Accepts { email, password }.
// Looks up the fleet_managers table, verifies the password with bcrypt, then
// issues a signed JWT containing { id, role } valid for JWT_EXPIRES_IN.
// Returns { token } on success, 401 on bad credentials, 500 on server error.
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await query(
            'SELECT id, full_name, work_email, password_hash FROM fleet_managers WHERE work_email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const manager = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, manager.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: manager.id, role: 'fleet_manager' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        return res.status(200).json({
            token,
            user: {
                id: manager.id,
                full_name: manager.full_name,
                email: manager.work_email
            }
        });
    } catch (err) {
        console.error('[auth] login error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── POST /logout ────────────────────────────────────────────────────────────
// [FR4] Ephemeral Credential Management — JWT revocation via Redis blocklist.
// Accepts the JWT from the Authorization: Bearer header.
// Decodes the token (without re-verifying the signature) to read the `exp`
// claim, then stores the token in Redis under blocklist:<token> for exactly
// the remaining lifetime of the token.
//
// Why the blocklist approach?
// JWTs are stateless — the server cannot "cancel" a token once issued.
// Storing the token in Redis for its remaining TTL gives us server-side
// invalidation without permanent state: Redis automatically evicts the entry
// when the token would have expired anyway. Downstream middleware checks this
// blocklist before honouring any protected request. This is how ephemeral
// credentials are revoked without requiring a persistent session store.
router.post('/logout', async (req, res) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7); // strip "Bearer "

    try {
        // jwt.decode() does NOT verify the signature — that is intentional here.
        // We only need the exp claim to compute the remaining TTL for the blocklist
        // entry. Full signature verification happens in the auth middleware.
        const decoded = jwt.decode(token);

        if (!decoded || !decoded.exp) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        const nowSeconds = Math.floor(Date.now() / 1000);
        const ttl = decoded.exp - nowSeconds;

        if (ttl > 0) {
            // Store token in Redis blocklist for exactly its remaining lifetime.
            // Redis will evict this key automatically — no zombie revocation state.
            await setSession(`blocklist:${token}`, true, ttl);
        }
        // If ttl <= 0 the token is already expired — no need to blocklist it.

        return res.status(200).json({ message: 'logged out' });
    } catch (err) {
        console.error('[auth] logout error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
