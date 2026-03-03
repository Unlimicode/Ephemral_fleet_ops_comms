import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import { getSession } from '../config/redisHelpers.js';
import tripsRouter from '../routes/trips.js';
import driversRouter from '../routes/drivers.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { initIo } from '../socket/io.js';

// Setup inline Express app to test the trips router exactly as mounted
const app = express();
const httpServer = createServer(app);
initIo(httpServer); // Initialize the module-level io instance used by the router

app.use(express.json());
app.use('/api/trips', tripsRouter);
app.use('/api/drivers', driversRouter);

// Base URLs
const TRIPS_API = '/api/trips';
const AUTH_API = 'http://localhost:3001/api/auth'; // We assume the dev server is running or we just hit our own auth logic directly... 
// Wait, we need a token. We can just generate one directly instead of making an HTTP call, 
// since we have the DB and JWT_SECRET available here.

describe('Trip Lifecycle & Privacy Guarantees', () => {
    let authToken;
    let managerId;
    let driverId;
    let vehicleId;
    let driverToken;
    let currentTripId; // Keep track of the trip across sequential tests

    beforeAll(async () => {
        // 0. Connect to DB and Redis
        await connectDb();
        await connectRedis();

        // 1. Get the seeded test manager
        const managerResult = await pool.query(
            "SELECT id FROM fleet_managers WHERE work_email = 'manager@fleetops.dev'"
        );
        if (managerResult.rows.length === 0) {
            throw new Error('Test manager not found. Did you run seedData.js?');
        }
        managerId = managerResult.rows[0].id;

        // 2. Generate a valid token
        authToken = jwt.sign(
            { id: managerId, role: 'fleet_manager' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // 3. Seed test driver
        const driverHash = await bcrypt.hash('driverpassword', 10);
        const driverResult = await pool.query(
            `INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status) 
             VALUES ($1, 'Test Driver', 'trips_unique_driver@test.com', 'EMP-TRIPS-001', $2, true) 
             RETURNING id`,
            [managerId, driverHash]
        );
        driverId = driverResult.rows[0].id;

        // Login explicitly to acquire the native driverToken evaluating through RBAC
        const loginRes = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'trips_unique_driver@test.com', password: 'driverpassword' });
        driverToken = loginRes.body.token;

        // 4. Seed test vehicle
        const vehicleResult = await pool.query(
            `INSERT INTO vehicles (registration_number, type, capacity) 
             VALUES ('TEST-123', 'Sedan', 4) 
             RETURNING id`
        );
        vehicleId = vehicleResult.rows[0].id;
    });

    afterAll(async () => {
        // Cleanup test data
        if (currentTripId) {
            await pool.query('DELETE FROM audit_log WHERE target_id = $1', [currentTripId]);
        }
        await pool.query("DELETE FROM trips WHERE client_corporate_email = 'testclient@corp.com'");
        if (driverId) await pool.query('DELETE FROM drivers WHERE id = $1', [driverId]);
        if (vehicleId) await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);

        // Close connections
        await client.quit();
        await pool.end();
    });

    it('Test 1: Data minimisation — Create a trip (phone number not accepted)', async () => {
        const payload = {
            client_corporate_email: 'testclient@corp.com',
            client_first_name: 'Bob',
            pickup_location: 'Central Station',
            destination: 'Headquarters',
            pickup_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            phone_number: '+15559998888' // This malicious extra field should be ignored
        };

        const res = await request(app)
            .post(TRIPS_API)
            .set('Authorization', `Bearer ${authToken}`)
            .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.status).toBe('pending');
        expect(res.body.client_first_name).toBe('Bob');
        // The core privacy guarantee is that the schema and route completely ignore phone numbers
        expect(res.body.phone_number).toBeUndefined();

        currentTripId = res.body.id;
    });

    it('Test 2: State advancement — Assign a driver', async () => {
        expect(currentTripId).toBeDefined();

        const res = await request(app)
            .patch(`${TRIPS_API}/${currentTripId}/assign`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                driver_id: driverId,
                vehicle_id: vehicleId
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('accepted');
        expect(res.body.assigned_driver_id).toBe(driverId);
        expect(res.body.vehicle_id).toBe(vehicleId);
    });

    it('Test 3: Ephemeral session creation — Accept trip & verify Redis channels', async () => {
        expect(currentTripId).toBeDefined();

        // Ensure session doesn't exist yet before acceptance
        const preStatusRes = await request(app)
            .get(`${TRIPS_API}/${currentTripId}/session-status`)
            .set('Authorization', `Bearer ${authToken}`);
        expect(preStatusRes.body.driver_session_active).toBe(false);
        expect(preStatusRes.body.client_session_active).toBe(false);

        // Accept the trip
        const acceptRes = await request(app)
            .patch(`${TRIPS_API}/${currentTripId}/accept`)
            .set('Authorization', `Bearer ${driverToken}`);

        expect(acceptRes.status).toBe(200);
        expect(acceptRes.body.status).toBe('accepted');

        // Force transition to in_progress seamlessly simulating driverTrips.js
        await pool.query("UPDATE trips SET status = 'in_progress' WHERE id = $1", [currentTripId]);

        // Verify Redis channels were created
        const postStatusRes = await request(app)
            .get(`${TRIPS_API}/${currentTripId}/session-status`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(postStatusRes.status).toBe(200);
        expect(postStatusRes.body.driver_session_active).toBe(true);
        expect(postStatusRes.body.client_session_active).toBe(true);
        expect(postStatusRes.body.complaint_window_active).toBe(false);

        // Verify direct Redis payload for driver (no email allowed)
        const driverPayload = await getSession(`session:trip:${currentTripId}:driver`);
        expect(driverPayload.driver_id).toBe(driverId);
        expect(driverPayload.client_email).toBeUndefined(); // Guarantee: NEVER exposed to driver
    });

    it('Test 4: Guaranteed session destruction — Complete trip & verify Redis wiped', async () => {
        expect(currentTripId).toBeDefined();

        // Complete the trip
        const completeRes = await request(app)
            .patch(`${TRIPS_API}/${currentTripId}/complete`)
            .set('Authorization', `Bearer ${driverToken}`);

        expect(completeRes.status).toBe(200);
        expect(completeRes.body.status).toBe('completed');

        // Verify Redis channels were destroyed instantly and complaint window opened
        const endStatusRes = await request(app)
            .get(`${TRIPS_API}/${currentTripId}/session-status`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(endStatusRes.status).toBe(200);
        expect(endStatusRes.body.driver_session_active).toBe(false); // Destroyed
        expect(endStatusRes.body.client_session_active).toBe(false); // Destroyed
        expect(endStatusRes.body.complaint_window_active).toBe(true); // Opened
    });
});
