import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import pool, { connect as connectDb, query } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import { getSession } from '../config/redisHelpers.js';
import bookingsRouter from '../routes/bookings.js';

// Setup inline Express app to test the bookings router
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/bookings', bookingsRouter);

// Base URL
const API = '/api/bookings';

// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY/SECURITY GUARANTEE VALIDATION SUITE
// ─────────────────────────────────────────────────────────────────────────────
// These tests explicitly assert three core architectural guarantees:
// 1. Response Token Stripping: The plaintext token is NEVER exposed in the JSON response payload.
// 2. Single-Use Consumption: Tokens are immediately deleted from Redis upon read, neutralizing replay attacks.
// 3. Query-Level Data Minimisation: Internal employee identifiers (email/id) never leave the database join layer.
// ─────────────────────────────────────────────────────────────────────────────

describe('Client Authentication & Privacy Guarantees', () => {
    let activeToken;
    let tripIdA;
    let tripIdB; // Used for cross-client prohibition tests
    let clientSessionCookie;

    // Seed Driver payload for View endpoint testing
    let driverId;
    let fmId;

    beforeAll(async () => {
        await connectDb();
        await connectRedis();

        // 0. Ensure we have a fleet manager to satisfy driver foreign key
        const fmResult = await query(
            `INSERT INTO fleet_managers (work_email, password_hash, full_name) 
             VALUES ('admin@test.com', 'dummy_hash', 'Test Admin') RETURNING id`
        );
        fmId = fmResult.rows[0].id;

        // Ensure we have a driver to test the SQL Join & Minimisation
        const res = await query(
            `INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, active_status) 
             VALUES ($1, 'Jane Test', 'jane.test@fleetops.dev', 'EMP-T1', true) RETURNING id`,
            [fmId]
        );
        driverId = res.rows[0].id;

        // Clean trips table just in case
        await query('DELETE FROM trips');
    });

    afterAll(async () => {
        await query('DELETE FROM trips');
        await query('DELETE FROM drivers WHERE id = $1', [driverId]);
        await query('DELETE FROM fleet_managers WHERE id = $1', [fmId]);
        await pool.end();
        await client.quit();
    });

    it('Scenario 1: Booking submission — 201, token generated in Redis, NO token in API response', async () => {
        const payload = {
            client_corporate_email: 'testA@client.com',
            client_first_name: 'Alice',
            pickup_location: 'Headquarters',
            destination: 'Airport',
            pickup_time: new Date().toISOString()
        };

        const response = await request(app)
            .post(API)
            .send(payload)
            .expect(201);

        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('trip_id');
        expect(response.body).not.toHaveProperty('token'); // Privacy Guarantee 1

        tripIdA = response.body.trip_id;

        // Extract token directly from Redis by scanning (since we don't have it)
        const keys = await client.keys('booking_access_token:*');
        expect(keys.length).toBeGreaterThanOrEqual(1);

        // Find our token payload
        let foundKey = null;
        for (const k of keys) {
            const raw = await client.get(k);
            const data = JSON.parse(raw);
            if (data.trip_id === tripIdA) {
                foundKey = k;
                break;
            }
        }

        expect(foundKey).not.toBeNull();
        activeToken = foundKey.split(':')[1]; // extract token portion

        // Let's also attach the driver to Trip A to setup Scenario 4
        await query('UPDATE trips SET assigned_driver_id = $1 WHERE id = $2', [driverId, tripIdA]);
    });

    it('Scenario 2: Token validation & cookie establishment — Single-use verification', async () => {
        const response = await request(app)
            .get(`${API}/auth?token=${activeToken}`)
            .expect(200);

        expect(response.body).toHaveProperty('message', 'Session established');
        expect(response.body).toHaveProperty('trip_id', tripIdA);

        // Verify Set-Cookie explicitly
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();

        const cookieString = cookies[0];
        expect(cookieString).toMatch(/client_session=/);
        expect(cookieString).toMatch(/HttpOnly/);
        expect(cookieString).toMatch(/SameSite=Strict/);

        clientSessionCookie = cookieString.split(';')[0]; // Store exactly client_session=JWT for future requests

        // Privacy Guarantee 2: Single-use mechanism check (Token must be wiped from Redis)
        const zombieSession = await client.get(`booking_access_token:${activeToken}`);
        expect(zombieSession).toBeNull();
    });

    it('Scenario 3: Persistent session check — Hydrate state', async () => {
        const response = await request(app)
            .get(`${API}/session`)
            .set('Cookie', clientSessionCookie)
            .expect(200);

        // JWT contains explicit client identity
        expect(response.body).toHaveProperty('trip_id', tripIdA);
        expect(response.body).toHaveProperty('client_first_name', 'Alice');
    });

    it('Scenario 4: Booking view data minimisation', async () => {
        const response = await request(app)
            .get(`${API}/${tripIdA}`)
            .set('Cookie', clientSessionCookie)
            .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('pickup_location', 'Headquarters');
        expect(response.body).toHaveProperty('destination', 'Airport');

        // Ensure driver full name is present
        expect(response.body).toHaveProperty('driver_name', 'Jane Test');

        // Privacy Guarantee 3: Internal driver identities explicitly stripped via query boundaries
        expect(response.body).not.toHaveProperty('driver_email');
        expect(response.body).not.toHaveProperty('work_email');
        expect(response.body).not.toHaveProperty('employee_id');
        expect(response.body).not.toHaveProperty('phone_number');
    });

    it('Scenario 5: Cross-client access prevention', async () => {
        // Create Client B's trip natively in SQL
        const res = await query(
            `INSERT INTO trips
             (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, status)
             VALUES ('testB@client.com', 'Bob', 'Hotel', 'Office', $1, 'pending')
             RETURNING id`,
            [new Date().toISOString()]
        );
        tripIdB = res.rows[0].id;

        // Attempt to fetch Client B's trip using Client A's signed HttpOnly cookie
        const response = await request(app)
            .get(`${API}/${tripIdB}`)
            .set('Cookie', clientSessionCookie)
            .expect(403);

        expect(response.body).toHaveProperty('error', 'Unauthorized access to booking');
    });

    it('Scenario 6: Expired or invalid token check', async () => {
        const response = await request(app)
            .get(`${API}/auth?token=thisisacompletelyinvalidtokenstring`)
            .expect(401);

        expect(response.body).toHaveProperty('error', 'Invalid or expired access link');
    });

    it('Scenario 7: Booking history data minimisation', async () => {
        const response = await request(app)
            .get(`${API}/history`)
            .set('Cookie', clientSessionCookie)
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);

        // Assert no entry contains assigned_driver_id
        response.body.forEach(trip => {
            expect(trip).not.toHaveProperty('assigned_driver_id');
            expect(trip).toHaveProperty('pickup_location');
        });
    });
});
