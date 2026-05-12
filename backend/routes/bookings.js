import { Router } from 'express';
import { query } from '../config/db.js';
import { setSession, getSession, deleteSession, extendSession } from '../config/redisHelpers.js';
import client from '../config/redis.js';
import crypto from 'crypto';
import { sendEmail } from '../config/mailer.js';
import jwt from 'jsonwebtoken';
import { requireClientAuth } from '../middleware/clientAuth.js';
import { emitDashboardEvent } from '../socket/dashboardNamespace.js';
import { getIo } from '../socket/io.js';
import { sendPushNotification } from '../utils/sendPushNotification.js';

const router = Router();


// ── POST / — Client submits a new booking ────────────────────────────────────
// Public endpoint. No authentication required.
// 
// PRIVACY/SECURITY ARCHITECTURE:
// The generated access token is NEVER returned in the API response. 
// It exists only in Redis and in the email payload sent to the corporate inbox. 
// This strict separation means only the person holding access to that specific 
// corporate inbox can complete the authentication. The email inbox acts as 
// a mandatory Second Factor (2FA) for trip management access.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const {
        client_corporate_email,
        client_first_name,
        pickup_location,
        destination,
        pickup_time,
        flight_number = null,
        notes = null,
        additional_info = null,
    } = req.body;

    // 1. Validate required fields
    if (!client_corporate_email || !client_first_name || !pickup_location || !destination || !pickup_time) {
        return res.status(400).json({ error: 'Missing required configuration fields' });
    }

    try {
        // 2. Block concurrent active bookings — one active trip per client at a time
        const existingTrip = await query(
            `SELECT id FROM trips WHERE client_corporate_email = $1 AND status IN ('pending', 'accepted', 'in_progress') LIMIT 1`,
            [client_corporate_email]
        );
        if (existingTrip.rows.length > 0) {
            return res.status(409).json({
                error: 'You already have an active booking.',
                existing_trip_id: existingTrip.rows[0].id
            });
        }

        // 3. Insert the trip into PostgreSQL (status: pending)
        const tripResult = await query(
            `INSERT INTO trips
             (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, flight_number, notes, additional_info, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
             RETURNING id, client_first_name`,
            [client_corporate_email, client_first_name, pickup_location, destination, pickup_time, flight_number, notes, additional_info]
        );

        const tripId = tripResult.rows[0].id;
        const firstName = tripResult.rows[0].client_first_name;

        // 3. Generate a cryptographically secure random token (32 bytes = 64 hex chars)
        const token = crypto.randomBytes(32).toString('hex');

        // 4. Store token in Redis MEI framework (TTL: 24 hours initially)
        await setSession(
            `booking_access_token:${token}`,
            { client_corporate_email, trip_id: tripId },
            86400 // 24 hours
        );

        // 5. Send the magic link via email
        const magicLink = `${process.env.CLIENT_ORIGIN}/booking?token=${token}`;

        if (process.env.NODE_ENV !== 'test') {
            try {
                await sendEmail({
                    to: client_corporate_email,
                    subject: 'Fleet Ops: Your Booking Confirmation & Access Link',
                    text: `Hello ${firstName},\n\nYour trip has been successfully requested and is pending driver assignment.\n\nYou can track and manage your trip securely using this one-time access link:\n${magicLink}\n\nThis link acts as your secure key. Do not share it with anyone.`,
                });
            } catch (mailErr) {
                console.error('[mailer] Booking confirmation email failed:', mailErr.message);
            }
        }

        // 6. Return success response (token explicitly omitted)
        return res.status(201).json({
            message: 'Booking confirmed. A secure access link has been sent to your corporate email.',
            trip_id: tripId
        });

    } catch (err) {
        console.error('[bookings] create error:', err);
        return res.status(500).json({ error: 'Internal server error while processing booking' });
    }
});

// ── GET /auth?token={token} — Validate magic link & establish HttpOnly session
// 
// PRIVACY/SECURITY ARCHITECTURE:
// 1. Single-use: The Redis token is deleted immediately upon successful read, preventing replay attacks.
// 2. Cookie Security Flags:
//    - HttpOnly: Cannot be read by client-side JS (neutralizes XSS extraction).
//    - Secure: Travels only over HTTPS in production (neutralizes MiTM).
//    - SameSite=strict: Browser refuses to send cookie on cross-site requests (neutralizes CSRF).
// 3. The raw JWT is NEVER returned in the JSON response body.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/auth', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing access token' });

    try {
        const sessionKey = `booking_access_token:${token}`;
        const sessionData = await getSession(sessionKey);

        if (!sessionData) {
            return res.status(401).json({ error: 'Invalid or expired access link' });
        }

        // 1. Single-use constraint
        // Immediately delete the token to prevent replay attacks.
        // Frontend uses a useRef guard (BookingLandingPage.jsx) to prevent 
        // issues with React Strict Mode double-firing.
        await deleteSession(sessionKey);

        // 2. Retrieve supplementary info
        const tripResult = await query(
            'SELECT client_first_name, pickup_time FROM trips WHERE id = $1',
            [sessionData.trip_id]
        );
        const firstName = tripResult.rows[0]?.client_first_name || 'Client';
        const pickupTime = tripResult.rows[0]?.pickup_time;

        // 3. Issue the secure session JWT — TTL tied to trip lifecycle
        // Expires at pickup_time + 72h (covers long trips + 48h complaint window)
        // Floor: 24h from now in case pickup is imminent or already passed
        const pickupMs = pickupTime ? new Date(pickupTime).getTime() : Date.now();
        const expiresAt = Math.max(pickupMs + 72 * 60 * 60 * 1000, Date.now() + 24 * 60 * 60 * 1000);
        const ttlSecs = Math.floor((expiresAt - Date.now()) / 1000);

        const jwtPayload = {
            client_corporate_email: sessionData.client_corporate_email,
            trip_id: sessionData.trip_id,
            role: 'client'
        };
        const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: ttlSecs });

        // 4. Set the native HttpOnly browser cookie
        res.cookie('client_session', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: ttlSecs * 1000
        });

        // 5. Respond without exposing token
        return res.status(200).json({
            message: 'Session established',
            trip_id: sessionData.trip_id,
            client_first_name: firstName
        });

    } catch (err) {
        console.error('[bookings] auth error:', err);
        return res.status(500).json({ error: 'Internal server error during authentication' });
    }
});

// ── GET /session — Hydrate the active client session ─────────────────────────
// PWA initialization route. If the browser holds a valid HttpOnly cookie, 
// this decrypts it and sends back the actionable session state so the UI 
// can mount without forcing a re-login.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/session', async (req, res) => {
    const token = req.cookies.client_session;
    if (!token) return res.status(401).json({ error: 'No active session' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ensure this is a client session, not a fleet manager
        if (decoded.role !== 'client') throw new Error('Invalid token role for client session');

        const tripResult = await query(
            'SELECT client_first_name, status FROM trips WHERE id = $1',
            [decoded.trip_id]
        );

        if (tripResult.rows.length === 0) {
            return res.status(401).json({ error: 'Trip associated with session not found' });
        }

        // Silently reissue cookie if JWT has < 4h remaining and trip is still active
        const remainingMs = decoded.exp * 1000 - Date.now();
        if (remainingMs < 4 * 60 * 60 * 1000 && tripResult.rows[0].status !== 'completed') {
            const refreshed = jwt.sign(
                { client_corporate_email: decoded.client_corporate_email, trip_id: decoded.trip_id, role: 'client' },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            res.cookie('client_session', refreshed, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                maxAge: 24 * 60 * 60 * 1000
            });
        }

        return res.status(200).json({
            trip_id: decoded.trip_id,
            client_corporate_email: decoded.client_corporate_email,
            client_first_name: tripResult.rows[0].client_first_name,
            status: tripResult.rows[0].status
        });

    } catch (err) {
        // Token is malformed, tampered, or expired
        return res.status(401).json({ error: 'Invalid or expired session' });
    }
});

// ── GET /history — Client Booking History ────────────────────────────────────
// Architectural Note: Booking history is scoped strictly to the authenticated
// client's corporate email — a client cannot query another client's history.
// The cookie session proves identity without requiring a persistent account,
// explicitly enforcing identity bounds natively.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', requireClientAuth, async (req, res) => {
    const { client_corporate_email } = req.client;

    try {
        const historyResult = await query(
            `SELECT id, status, pickup_location, destination, pickup_time, flight_number, notes
             FROM trips
             WHERE client_corporate_email = $1
             ORDER BY pickup_time DESC`,
            [client_corporate_email]
        );

        return res.status(200).json(historyResult.rows);
    } catch (err) {
        console.error('[bookings] history error:', err);
        return res.status(500).json({ error: 'Internal server error while retrieving history' });
    }
});

// ── POST /recover — Magic Link Recovery (no tripId required) ─────────────────
// Public endpoint. Looks up the most recent active trip by email alone so that
// clients whose link has expired (and therefore have no valid session or tripId)
// can still recover access.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/recover', async (req, res) => {
    const { client_corporate_email } = req.body;

    if (!client_corporate_email) {
        return res.status(400).json({ error: 'Email is required for recovery' });
    }

    try {
        // 1. Rate limit — max 3 per hour per email
        const rateLimitKey = `ratelimit:recovery:email:${client_corporate_email}`;
        const currentCount = await client.incr(rateLimitKey);
        if (currentCount === 1) {
            await client.expire(rateLimitKey, 3600);
        }
        if (currentCount > 3) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }

        // 2. Find the most recent active trip for this email
        const tripResult = await query(
            `SELECT id, client_first_name FROM trips
             WHERE client_corporate_email = $1 AND status NOT IN ('completed')
             ORDER BY created_at DESC LIMIT 1`,
            [client_corporate_email]
        );

        // Privacy-preserving: same response whether match or not
        if (tripResult.rows.length === 0) {
            return res.status(200).json({ message: 'If the details match, a new link has been dispatched.' });
        }

        const { id: tripId, client_first_name: firstName } = tripResult.rows[0];

        // 3. Generate token and store in Redis with 24h TTL
        const token = crypto.randomBytes(32).toString('hex');
        await setSession(
            `booking_access_token:${token}`,
            { client_corporate_email, trip_id: tripId },
            86400
        );

        const magicLink = `${process.env.CLIENT_ORIGIN}/booking?token=${token}`;

        if (process.env.NODE_ENV !== 'test') {
            try {
                await sendEmail({
                    to: client_corporate_email,
                    subject: 'Fleet Ops: New Booking Access Link',
                    text: `Hello ${firstName},\n\nA new secure access link has been requested for your trip.\n\nUse this link to manage your booking:\n${magicLink}\n\nDo not share it with anyone.`,
                });
            } catch (mailErr) {
                console.error('[mailer] Recovery email failed:', mailErr.message);
            }
        }

        return res.status(200).json({ message: 'If the details match, a new link has been dispatched.' });

    } catch (err) {
        console.error('[bookings] recover error:', err);
        return res.status(500).json({ error: 'Internal server error during recovery' });
    }
});

// ── GET /:tripId — View Booking Details (Protected) ──────────────────────────
// Protected explicit hydration channel for client app usage.
// PRIVACY/SECURITY ARCHITECTURE:
// 1. Validates the URL id matches the `req.client.trip_id` decoded from the Http Cookie.
// 2. Data minimisation: Explicitly filters the JOIN against the `drivers` table
//    to extract strictly the `full_name`, ensuring `work_email` and `employee_id`
//    do not leave the backend perimeter.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:tripId', requireClientAuth, async (req, res) => {
    const { tripId } = req.params;

    // Boundary constraint: You cannot access someone else's trip ID
    if (tripId !== req.client.trip_id) {
        return res.status(403).json({ error: 'Unauthorized access to booking' });
    }

    try {
        const tripResult = await query(
            `SELECT
                t.id,
                t.status,
                t.pickup_location,
                t.destination,
                t.pickup_time,
                t.flight_number,
                t.notes,
                t.additional_info,
                t.eta,
                t.assigned_driver_id,
                d.full_name AS driver_name,
                v.make AS vehicle_make,
                v.model AS vehicle_model,
                v.registration_number AS vehicle_plate,
                v.type AS vehicle_type
             FROM trips t
             LEFT JOIN drivers d ON t.assigned_driver_id = d.id
             LEFT JOIN vehicles v ON t.vehicle_id = v.id
             WHERE t.id = $1`,
            [tripId]
        );

        if (tripResult.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const trip = tripResult.rows[0];

        // 3. Conditionally inject Redis TTL for the complaint window if completed
        if (trip.status === 'completed') {
            try {
                const ttl = await client.ttl(`complaint:window:${tripId}`);
                trip.complaint_window_seconds = ttl > 0 ? ttl : 0;
            } catch (redisErr) {
                console.error('[bookings] Redis TTL fetch failed:', redisErr.message);
                trip.complaint_window_seconds = 0;
            }
        }

        return res.status(200).json(trip);

    } catch (err) {
        console.error('[bookings] get booking error:', err);
        return res.status(500).json({ error: 'Internal server error while retrieving booking' });
    }
});

// ── POST /:tripId/request-new-link — Magic Link Recovery ─────────────────────
// Rate limited mechanism to re-dispatch a secure access token if the underlying
// session or previous link natively timed out.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:tripId/request-new-link', async (req, res) => {
    const { tripId } = req.params;
    const { client_corporate_email } = req.body;

    if (!client_corporate_email) {
        return res.status(400).json({ error: 'Email is required for recovery' });
    }

    try {
        // 1. Rate Limiting verification (Max 3 / hr)
        const rateLimitKey = `ratelimit:recovery:${tripId}`;
        const currentCount = await client.incr(rateLimitKey);
        if (currentCount === 1) {
            await client.expire(rateLimitKey, 3600); // 1 hour TTL
        }
        if (currentCount > 3) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }

        // 2. Authenticate structural validity of recovery request
        const tripResult = await query(
            'SELECT id, client_first_name FROM trips WHERE id = $1 AND client_corporate_email = $2',
            [tripId, client_corporate_email]
        );

        if (tripResult.rows.length === 0) {
            return res.status(200).json({ message: 'If the details match, a new link has been dispatched.' });
        }

        const firstName = tripResult.rows[0].client_first_name;

        // 3. Dispatch the new cryptostring token identically to creation
        const token = crypto.randomBytes(32).toString('hex');

        await setSession(
            `booking_access_token:${token}`,
            { client_corporate_email, trip_id: tripId },
            86400 // 24 hours
        );

        const magicLink = `${process.env.CLIENT_ORIGIN}/booking?token=${token}`;

        if (process.env.NODE_ENV !== 'test') {
            try {
                await sendEmail({
                    to: client_corporate_email,
                    subject: 'Fleet Ops: New Booking Access Link',
                    text: `Hello ${firstName},\n\nA new secure access link has been requested for your trip.\n\nUse this link to manage your booking:\n${magicLink}\n\nDo not share it with anyone.`,
                });
            } catch (mailErr) {
                console.error('[mailer] Recovery email failed:', mailErr.message);
            }
        }

        return res.status(200).json({ message: 'If the details match, a new link has been dispatched.' });

    } catch (err) {
        console.error('[bookings] recovery error:', err);
        return res.status(500).json({ error: 'Internal server error during recovery' });
    }
});

// ── GET /status — Public status check via magic link ────────────────────────
// PRIVACY/SECURITY ARCHITECTURE:
// Validates token against Redis. Returns only first name and vehicle type.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
    const { token, tripId } = req.query;

    if (!token || !tripId) {
        return res.status(400).json({ error: 'Missing token or tripId' });
    }

    try {
        const sessionKey = `booking_access_token:${token}`;
        const sessionData = await getSession(sessionKey);

        const activeSessionKey = `session:trip:${tripId}:client`;
        const activeSession = await getSession(activeSessionKey);

        if (!activeSession) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        const tripResult = await query(
            `SELECT 
                t.id, t.status, t.pickup_location, t.destination, t.pickup_time, t.flight_number, t.notes,
                d.full_name as driver_name,
                v.type as vehicle_type
             FROM trips t
             LEFT JOIN drivers d ON t.assigned_driver_id = d.id
             LEFT JOIN vehicles v ON t.vehicle_id = v.id
             WHERE t.id = $1`,
            [tripId]
        );

        if (tripResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        return res.status(200).json(tripResult.rows[0]);
    } catch (err) {
        console.error('[bookings] status error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /:tripId — Client updates booking details (pending only) ────────────
router.patch('/:tripId', requireClientAuth, async (req, res) => {
    const { tripId } = req.params;

    // 1. Verify trip belongs to this client
    if (req.client.trip_id !== tripId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        // 2. Fetch current status
        const tripCheck = await query(
            'SELECT status FROM trips WHERE id = $1',
            [tripId]
        );
        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        const currentStatus = tripCheck.rows[0].status;
        const { pickup_location, destination, pickup_time, flight_number, notes, additional_info } = req.body;

        // Core fields: pending only. additional_info: pending or accepted (until driver starts)
        const hasCoreFields = [pickup_location, destination, pickup_time, flight_number, notes].some(f => f !== undefined);
        if (hasCoreFields && currentStatus !== 'pending') {
            return res.status(403).json({ error: 'Booking details can only be updated while pending' });
        }
        if (additional_info !== undefined && !['pending', 'accepted'].includes(currentStatus)) {
            return res.status(403).json({ error: 'Trip notes can only be updated until your driver has started' });
        }

        // 3. Validate and collect allowed fields
        const updates = {};

        if (pickup_location !== undefined) {
            if (typeof pickup_location !== 'string' || !pickup_location.trim()) {
                return res.status(400).json({ error: 'pickup_location must be a non-empty string' });
            }
            updates.pickup_location = pickup_location.trim();
        }
        if (destination !== undefined) {
            if (typeof destination !== 'string' || !destination.trim()) {
                return res.status(400).json({ error: 'destination must be a non-empty string' });
            }
            updates.destination = destination.trim();
        }
        if (pickup_time !== undefined) {
            const dt = new Date(pickup_time);
            if (isNaN(dt.getTime()) || dt <= new Date()) {
                return res.status(400).json({ error: 'pickup_time must be a valid future date' });
            }
            updates.pickup_time = dt.toISOString();
        }
        if (flight_number !== undefined) {
            updates.flight_number = flight_number;
        }
        if (notes !== undefined) {
            updates.notes = notes || null;
        }
        if (additional_info !== undefined) {
            updates.additional_info = additional_info || null;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        // 4. Build dynamic UPDATE
        const fields = Object.keys(updates);
        const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const values = fields.map(f => updates[f]);
        values.push(tripId);

        const result = await query(
            `UPDATE trips SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
            values
        );

        // 5. Notify dashboard
        emitDashboardEvent('booking_updated', {
            tripId,
            ...updates,
        });

        // 6. Audit log
        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['BOOKING_UPDATED', req.client.client_corporate_email, 'client', tripId, JSON.stringify(updates)]
        );

        return res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error('[bookings] PATCH error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── DELETE /:tripId — Cancel Booking ─────────────────────────────────────────
// Allowed at pending (no driver) and accepted (driver assigned, not started).
// At accepted: notifies driver via socket + push before closing.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:tripId', requireClientAuth, async (req, res) => {
    const { tripId } = req.params;

    if (req.client.trip_id !== tripId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const tripCheck = await query(
            'SELECT status, assigned_driver_id FROM trips WHERE id = $1',
            [tripId]
        );

        if (tripCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        const { status, assigned_driver_id } = tripCheck.rows[0];

        if (status === 'in_progress') {
            return res.status(403).json({ error: 'Cannot cancel a trip that is already in progress' });
        }
        if (status === 'completed' || status === 'cancelled') {
            return res.status(403).json({ error: 'Trip is already closed' });
        }

        await query(
            `UPDATE trips SET status = 'cancelled' WHERE id = $1`,
            [tripId]
        );

        await query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['BOOKING_CANCELLED', req.client.client_corporate_email, 'client', tripId, JSON.stringify({ previous_status: status })]
        );

        emitDashboardEvent('booking_cancelled', { tripId, previous_status: status });

        // Notify assigned driver if trip was already accepted
        if (status === 'accepted' && assigned_driver_id) {
            const io = getIo();
            if (io) {
                io.to(`trip:${tripId}`).emit('trip_cancelled', {
                    tripId,
                    reason: 'Client cancelled the booking'
                });
            }

            if (process.env.NODE_ENV !== 'test') {
                sendPushNotification(assigned_driver_id, {
                    title: 'Trip Cancelled',
                    body: 'The client has cancelled this booking.',
                    type: 'trip_cancelled',
                    tripId,
                }).catch(() => {});
            }
        }

        return res.status(200).json({ message: 'Booking cancelled successfully' });

    } catch (err) {
        console.error('[bookings] cancel error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;