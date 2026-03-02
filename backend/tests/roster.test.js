import { jest } from '@jest/globals';
import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import { setSession } from '../config/redisHelpers.js';
import rosterRouter from '../routes/roster.js';
import vehiclesRouter from '../routes/vehicles.js';
import driversRouter from '../routes/drivers.js';
import driverTripsRouter from '../routes/driverTrips.js';
import tripsRouter from '../routes/trips.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────────────────────
// PROOF OF ARCHITECTURE: Secure Identity Provisioning & Immediate Termination
// ─────────────────────────────────────────────────────────────────────────────
// These tests prove two critical architectural guarantees for Phase 5.7:
// 1. Zero-Knowledge Credential Provisioning: Passwords never appear in API responses,
//    enforcing the principle that sensitive data explicitly only exists in transit 
//    via Nodemailer, shielding the API outputs from credential harvesting architectures.
// 2. Physical Immediate Session Revocation: Deactivation explicitly skips standard 
//    JWT Expiry evaluations executing immediate blocklist injections natively via Redis 
//    tearing down persistent attackers unequivocally.
// ─────────────────────────────────────────────────────────────────────────────

jest.setTimeout(25000);

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use('/api/roster', rosterRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/driver/trips', driverTripsRouter);
app.use('/api/trips', tripsRouter);

describe('Roster & Vehicle Management API', () => {
    let managerToken;
    let managerId;
    let newDriverId;
    let newVehicleId;
    let tripId;
    let rawPassword; // Only tracked locally for simulation

    beforeAll(async () => {
        await connectDb();
        await connectRedis();

        // 1. Setup Fleet Manager
        const hash = await bcrypt.hash('managerpass', 10);
        const managerResult = await pool.query(
            "INSERT INTO fleet_managers (full_name, work_email, password_hash) VALUES ('Bob M', 'roster@manager.com', $1) RETURNING id",
            [hash]
        );
        managerId = managerResult.rows[0].id;
        managerToken = jwt.sign({ id: managerId, role: 'fleet_manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        await new Promise((resolve) => httpServer.close(resolve));

        // Cleanup Native Resources
        if (tripId) await pool.query('DELETE FROM trips WHERE id = $1', [tripId]);
        if (newVehicleId) await pool.query('DELETE FROM vehicles WHERE id = $1', [newVehicleId]);
        if (newDriverId) await pool.query('DELETE FROM drivers WHERE id = $1', [newDriverId]);
        await pool.query('DELETE FROM fleet_managers WHERE id = $1', [managerId]);

        await pool.end();
        await client.quit();
    });

    it('Test 1: Add driver - credentials purely in transit, not in response', async () => {
        const res = await request(app)
            .post('/api/roster/drivers')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
                full_name: 'Charlie Test',
                work_email: 'charlie@testfleet.com',
                employee_id: 'DRV-1001'
            });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('driver_id');
        expect(res.body.driver_id).toBeDefined();

        // ARCHITECTURE VALIDATION: Exposing properties proves structural data leakage. Must be inherently undefined.
        expect(res.body.password).toBeUndefined();
        expect(res.body.temporary_password).toBeUndefined();

        newDriverId = res.body.driver_id;
    });

    it('Test 2: Deactivated driver cannot login', async () => {
        // Deactivate physically
        const res = await request(app)
            .patch(`/api/roster/drivers/${newDriverId}/deactivate`)
            .set('Authorization', `Bearer ${managerToken}`);

        expect(res.status).toBe(200);

        // Simulated attempting to authenticate
        // (We don't actually know the random 16-byte hex, but the endpoint rejects based on Active Status prior to checking matching hashes).
        const loginRes = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'charlie@testfleet.com', password: 'randomstring' });

        expect(loginRes.status).toBe(401);
        expect(loginRes.body.error).toMatch(/Account deactivated/i);
    });

    it('Test 3: Deactivation physically revokes active sessions via Redis', async () => {
        // Create an active driver temporarily
        const hash = await bcrypt.hash('tempP@ss', 10);
        const tempDriveRes = await pool.query(
            "INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status) VALUES ($1, 'Temp D', 'temp@fleet.com', 'DRV-999', $2, true) RETURNING id",
            [managerId, hash]
        );
        const tempDriveId = tempDriveRes.rows[0].id;

        // Login explicitly acquiring active session JWT
        const loginRes = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'temp@fleet.com', password: 'tempP@ss' });

        expect(loginRes.status).toBe(200);
        const oldToken = loginRes.body.token;

        // Trigger Fleet Manager `.deactivate` flow
        const deacRes = await request(app)
            .patch(`/api/roster/drivers/${tempDriveId}/deactivate`)
            .set('Authorization', `Bearer ${managerToken}`);

        expect(deacRes.status).toBe(200);

        // Attempt a protected request utilizing the previously captured token.
        // It should forcefully reject regardless of the `8h` typical valid window natively.
        const blockedReq = await request(app)
            .get('/api/driver/trips')
            .set('Authorization', `Bearer ${oldToken}`);

        expect(blockedReq.status).toBe(401);
        expect(blockedReq.body.error).toBe('Session invalidated');

        // Cleanup
        await pool.query('DELETE FROM drivers WHERE id = $1', [tempDriveId]);
    });

    it('Test 4: Add vehicle returns correctly structured capacities', async () => {
        const res = await request(app)
            .post('/api/vehicles')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
                registration_number: 'VAN-444',
                type: 'Passenger Van',
                capacity: 8
            });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.registration_number).toBe('VAN-444');
        expect(res.body.capacity).toBe(8);

        newVehicleId = res.body.id;
    });

    it('Test 5: Vehicle deployment status dynamically blocks deletions natively', async () => {
        // Instantiate synthetic trip locking the vehicle
        const tripRes = await pool.query(
            "INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id) VALUES ('c@corp.com', 'Test', 'L A', 'D B', NOW(), 'in_progress', $1, $2) RETURNING id",
            [newDriverId, newVehicleId] // assigning to the deactivated driver is fine for postgres structure simulation
        );
        tripId = tripRes.rows[0].id;

        const deleteRes = await request(app)
            .delete(`/api/vehicles/${newVehicleId}`)
            .set('Authorization', `Bearer ${managerToken}`);

        expect(deleteRes.status).toBe(409);
        expect(deleteRes.body.error).toBe('Vehicle is currently deployed');
    });

    it('Test 6: Vehicle deployment tracks dynamically in API responses', async () => {
        const res = await request(app)
            .get('/api/vehicles')
            .set('Authorization', `Bearer ${managerToken}`);

        expect(res.status).toBe(200);

        const van = res.body.find(v => v.registration_number === 'VAN-444');
        expect(van.deployment_status).toBe('deployed');
    });

    it('Test 7: Roster executions explicitly log natively generating audit traces', async () => {
        // Verify DRIVER_ADDED
        const driverAudit = await pool.query("SELECT * FROM audit_log WHERE action_type = 'DRIVER_ADDED' AND target_id = $1", [newDriverId]);
        expect(driverAudit.rows.length).toBe(1);
        expect(driverAudit.rows[0].details.employee_id).toBe('DRV-1001');

        // Verify VEHICLE_ADDED
        const vehicleAudit = await pool.query("SELECT * FROM audit_log WHERE action_type = 'VEHICLE_ADDED' AND target_id = $1", [newVehicleId]);
        expect(vehicleAudit.rows.length).toBe(1);
        expect(vehicleAudit.rows[0].details.registration_number).toBe('VAN-444');
    });
});
