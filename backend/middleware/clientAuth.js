import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────────────────────
// [FR2] Client Authentication via EDAT — HttpOnly cookie session enforcement.
//
// Middleware: requireClientAuth
// ─────────────────────────────────────────────────────────────────────────────
// Mirrors requireAuth but exclusively parses HttpOnly cookies instead of the
// standard Authorization header. This makes it impossible for client-side JS
// (or injected XSS payloads) to extract or manipulate the session JWT.
//
// WHY a separate middleware for clients?
// Manager/driver tokens: Authorization: Bearer header — JS-accessible by design (they're apps).
// Client tokens: HttpOnly cookie — JS cannot read this at all. The browser manages it.
// This is the key mechanism that satisfies FR2: the client session credential is
// stored in a location that is structurally inaccessible to any script running on the page.
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
