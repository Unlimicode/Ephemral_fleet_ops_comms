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

            req.user = decoded;
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    };
}
