import { Router } from 'express';
import { query } from '../config/db.js';
import { setSession } from '../config/redisHelpers.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const router = Router();

// Configure the SMTP transporter using environment variables
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: process.env.MAIL_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

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
    } = req.body;

    // 1. Validate required fields
    if (!client_corporate_email || !client_first_name || !pickup_location || !destination || !pickup_time) {
        return res.status(400).json({ error: 'Missing required configuration fields' });
    }

    try {
        // 2. Insert the trip into PostgreSQL (status: pending)
        const tripResult = await query(
            `INSERT INTO trips
             (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, flight_number, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')
             RETURNING id, client_first_name`,
            [client_corporate_email, client_first_name, pickup_location, destination, pickup_time, flight_number]
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

        await transporter.sendMail({
            from: process.env.MAIL_FROM || '"Fleet Ops" <noreply@fleetops.dev>',
            to: client_corporate_email,
            subject: 'Fleet Ops: Your Booking Confirmation & Access Link',
            text: `Hello ${firstName},\n\nYour trip has been successfully requested and is pending driver assignment.\n\nYou can track and manage your trip securely using this one-time access link:\n${magicLink}\n\nThis link acts as your secure key. Do not share it with anyone.`,
            html: `
                <h3>Hello ${firstName},</h3>
                <p>Your trip has been successfully requested and is pending driver assignment.</p>
                <p>You can track and manage your trip securely using this access link:</p>
                <p><a href="${magicLink}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track My Trip</a></p>
                <p><em>This link acts as your secure key. Do not share it with anyone.</em></p>
            `
        });

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

export default router;
