import jwt from 'jsonwebtoken';
import { getSession } from '../config/redisHelpers.js';
import { query } from '../config/db.js';

/**
 * [FR4] Ephemeral Credential Management — JWT verification pipeline.
 * [FR1] Role-based access control gate for all manager and driver routes.
 *
 * Express middleware that protects routes by:
 *   1. Extracting the JWT from the Authorization: Bearer header
 *   2. Checking the Redis blocklist for the token (fast Redis read before crypto)
 *      WHY: logout stores the token here — this is how revocation is enforced before expiry
 *   3. Verifying the JWT signature and expiry with JWT_SECRET
 *   4. Checking allowedRoles — enforces RBAC (e.g. drivers cannot access manager routes)
 *   5. For driver tokens: verifying active_status in the DB so deactivation takes
 *      immediate effect even though the JWT is still cryptographically valid
 *   6. Attaching the decoded payload as req.user and calling next()
 */
export function requireAuth(allowedRoles = []) {
    return async (req, res, next) => {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.slice(7);

        try {
            const isBlocklisted = await getSession(`blocklist:${token}`);
            if (isBlocklisted) {
                return res.status(401).json({ error: 'Session invalidated' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            // Driver accounts can be deactivated while a valid JWT is still in circulation.
            // A blocklist entry is attempted at deactivation time but can be missed if the
            // availability session was overwritten without the token field. This DB check
            // closes that gap: a deactivated driver is rejected on every subsequent request
            // regardless of whether their token was explicitly blocklisted.
            if (decoded.role === 'driver') {
                const driverCheck = await query(
                    'SELECT active_status FROM drivers WHERE id = $1',
                    [decoded.id]
                );
                if (driverCheck.rows.length === 0 || !driverCheck.rows[0].active_status) {
                    return res.status(401).json({ error: 'Account deactivated' });
                }
            }

            req.user = decoded;
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    };
}
