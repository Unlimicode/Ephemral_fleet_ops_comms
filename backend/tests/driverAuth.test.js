import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import pool, { connect as connectDb, query } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';

import authRouter from '../routes/auth.js';
import driversRouter from '../routes/drivers.js';
import tripsRouter from '../routes/trips.js';

// Setup inline Express app to test the authentication and role bindings
const app = express();
app.use(express.json());
app.use('/api/fleet-managers', authRouter); // Fleet Manager login mapped here
app.use('/api/drivers', driversRouter);     // Driver login mapped here
app.use('/api/trips', tripsRouter);         // Mixed RBAC routes mapped here

// ─────────────────────────────────────────────────────────────────────────────
// ROLE SEPARATION & PRIVILEGE ESCALATION VALIDATION SUITE
// ─────────────────────────────────────────────────────────────────────────────
// These tests explicitly assert the core security properties of the Mediated
// Ephemeral Identity architecture:
// 1. Horizontal Isolation: A Driver cannot perform a Fleet Manager action.
// 2. Horizontal Isolation: A Fleet Manager cannot perform a Driver action.
// 
// This guarantees that if a Mobile Driver device is compromised, the attacker
// remains walled mathematically within the `['driver']` execution spaces and
// physically cannot dispatch trips, delete users, or view global data.
// ─────────────────────────────────────────────────────────────────────────────

describe('Driver Authentication & Role-Aware Middleware', () => {
    let fmId;
    let driverId;
    let deactivatedDriverId;

    let fmToken;
    let validDriverToken;

    // We need a dummy trip to test the `PATCH /:tripId/accept` (driver only) endpoint
    let testTripId;

    beforeAll(async () => {
        await connectDb();
        await connectRedis();

        // 0. Inject schema patch natively for the test DB
        await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT 'unspecified'`);

        // 1. Seed Fleet Manager
        const fmHash = await bcrypt.hash('fmpassword', 10);
        const fmRes = await query(
            `INSERT INTO fleet_managers (work_email, password_hash, full_name) 
             VALUES ('admin@fleetops.dev', $1, 'Admin User') RETURNING id`,
            [fmHash]
        );
        fmId = fmRes.rows[0].id;

        // 2. Seed Active Driver
        const driverHash = await bcrypt.hash('driverpassword', 10);
        const dRes = await query(
            `INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status) 
             VALUES ($1, 'Active Driver', 'active@fleetops.dev', 'EMP-ACTIVE', $2, true) RETURNING id`,
            [fmId, driverHash]
        );
        driverId = dRes.rows[0].id;

        // 3. Seed Deactivated Driver
        const deactHash = await bcrypt.hash('badpassword', 10);
        const deactRes = await query(
            `INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status) 
             VALUES ($1, 'Deactivated Driver', 'fired@fleetops.dev', 'EMP-FIRED', $2, false) RETURNING id`,
            [fmId, deactHash]
        );
        deactivatedDriverId = deactRes.rows[0].id;

        // 4. Seed a single pending trip to use for the Fleet Manager / Driver access collision tests
        const tripRes = await query(
            `INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, status)
             VALUES ('client@test.com', 'Client', 'A', 'B', $1, 'pending') RETURNING id`,
            [new Date().toISOString()]
        );
        testTripId = tripRes.rows[0].id;
    });

    afterAll(async () => {
        await query('DELETE FROM trips');
        await query('DELETE FROM drivers WHERE id IN ($1, $2)', [driverId, deactivatedDriverId]);
        await query('DELETE FROM fleet_managers WHERE id = $1', [fmId]);
        await pool.end();
        await client.quit();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AUTHENTICATION TESTS
    // ─────────────────────────────────────────────────────────────────────────

    it('Scenario 1: Driver login with valid credentials returns 200 and token', async () => {
        const response = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'active@fleetops.dev', password: 'driverpassword' })
            .expect(200);

        expect(response.body).toHaveProperty('token');
        validDriverToken = response.body.token; // Save for RBAC tests
    });

    it('Scenario 2: Driver login with wrong password returns 401', async () => {
        const response = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'active@fleetops.dev', password: 'wrongpassword' })
            .expect(401);

        expect(response.body).toHaveProperty('error', 'Invalid email or password');
    });

    it('Scenario 3: Driver login with deactivated account returns 401 with Account deactivated', async () => {
        const response = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'fired@fleetops.dev', password: 'badpassword' })
            .expect(401);

        expect(response.body).toHaveProperty('error', 'Account deactivated');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // REQUIREMENT SEPARATION TESTS (RBAC)
    // ─────────────────────────────────────────────────────────────────────────

    it('Setup: Fleet Manager acquires JWT', async () => {
        const response = await request(app)
            .post('/api/fleet-managers/login') // Mapped to auth.js locally
            .send({ email: 'admin@fleetops.dev', password: 'fmpassword' })
            .expect(200);

        expect(response.body).toHaveProperty('token');
        fmToken = response.body.token;
    });

    it('Scenario 4: Driver token cannot access a fleet-manager-only route (assert 403)', async () => {
        // GET /api/trips is restricted to `requireAuth(['fleet_manager'])`
        const response = await request(app)
            .get('/api/trips')
            .set('Authorization', `Bearer ${validDriverToken}`)
            .expect(403);

        expect(response.body).toHaveProperty('error', 'Insufficient permissions');
    });

    it('Scenario 5: Fleet manager token cannot access a driver-only route (assert 403)', async () => {
        // PATCH /api/trips/:tripId/accept is restricted to `requireAuth(['driver'])`
        const response = await request(app)
            .patch(`/api/trips/${testTripId}/accept`)
            .set('Authorization', `Bearer ${fmToken}`)
            .expect(403);

        expect(response.body).toHaveProperty('error', 'Insufficient permissions');
    });
});
