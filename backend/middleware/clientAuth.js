import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: requireClientAuth
// ─────────────────────────────────────────────────────────────────────────────
// Mirrors requireAuth but exclusively parses HttpOnly cookies instead of the 
// standard Authorization header. This makes it impossible for client-side JS 
// (or injected XSS payloads) to extract or manipulate the session JWT.
// It acts as the primary enforcement point for all client-facing protected routes.
// ─────────────────────────────────────────────────────────────────────────────
export const requireClientAuth = (req, res, next) => {
    // 1. Extract the session from the HttpOnly cookie
    const token = req.cookies.client_session;

    if (!token) {
        return res.status(401).json({ error: 'No active client session' });
    }

    try {
        // 2. Verify cryptographically that the payload is untampered and active
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Optional safety: Ensure it's not a leaked fleet manager JWT being replayed
        if (decoded.role !== 'client') {
            throw new Error('Invalid role');
        }

        // 3. Attach payload and hand off exactly like standard passport flows
        req.client = decoded;
        next();
    } catch (err) {
        console.error('[clientAuth] verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid or expired session' });
    }
};
