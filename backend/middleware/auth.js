// ─────────────────────────────────────────────────────────────────────────────
// requireAuth Middleware — JWT Verification + Redis Blocklist Check
// ─────────────────────────────────────────────────────────────────────────────
// This middleware is the enforcement point for all protected routes.
// It combines JWT signature verification with a Redis blocklist check so that
// tokens explicitly invalidated at logout cannot be reused, even if their
// cryptographic signature remains valid for the remainder of their lifetime.
// ─────────────────────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import { getSession } from '../config/redisHelpers.js';

/**
 * Express middleware that protects routes by:
 *   1. Extracting the JWT from the Authorization: Bearer header
 *   2. Checking the Redis blocklist for the token (fast Redis read before crypto)
 *   3. Verifying the JWT signature and expiry with JWT_SECRET
 *   4. Attaching the decoded payload as req.user and calling next()
 */
export function requireAuth(allowedRoles = []) {
    return async (req, res, next) => {
        // ── Step 1: Extract token from header ────────────────────────────────────
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.slice(7); // strip "Bearer "

        try {
            // ── Step 2: Redis blocklist check ─────────────────────────────────────
            // Check this BEFORE jwt.verify() — a blocklist hit is a cheap Redis read
            // that short-circuits an unnecessary cryptographic operation for tokens
            // we already know are invalid (i.e. the user has logged out).
            const isBlocklisted = await getSession(`blocklist:${token}`);

            if (isBlocklisted) {
                return res.status(401).json({ error: 'Session invalidated' });
            }

            // ── Step 3: Verify JWT signature and expiry ───────────────────────────
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // ── Step 4: Role-Based Access Control (RBAC) ─────────────────────────
            if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            // ── Step 5: Attach payload and continue ──────────────────────────────
            req.user = decoded;
            return next();
        } catch (err) {
            // jwt.verify() throws JsonWebTokenError or TokenExpiredError on failure
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    };
}
