import { jest } from '@jest/globals';
import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import { getSession } from '../config/redisHelpers.js';
import driverTripsRouter from '../routes/driverTrips.js';
import driversRouter from '../routes/drivers.js';
import tripsRouter from '../routes/trips.js';
import { initIo, getIo } from '../socket/io.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────────────────────
// PROOF OF ARCHITECTURE: Driver Dispatch Security & Data Minimisation
// ─────────────────────────────────────────────────────────────────────────────
// These tests prove three core security properties:
// 1. Role Isolation: Drivers are actively prevented from accessing other
//    drivers' trip data through strict RBAC and query constraints.
// 2. Data Minimisation: The query layer structurally prevents client contact
//    details (like corporate email) from ever reaching the driver's device.
// 3. Availability Tracking: Operational state is efficiently maintained in Redis,
//    giving fleet managers real-time intelligence without permanent database I/O.
// ─────────────────────────────────────────────────────────────────────────────

jest.setTimeout(15000);

const app = express();
const httpServer = createServer(app);
initIo(httpServer);

app.use(express.json());
app.use('/api/drivers', driversRouter);
app.use('/api/driver/trips', driverTripsRouter);
app.use('/api/trips', tripsRouter); // Needed to assign trips as a manager

describe('Driver Trips & Availability API', () => {
    let managerToken;
    let driverA_Id, driverB_Id;
    let driverA_Token, driverB_Token;
    let vehicleId;
    let tripA_Id, tripB_Id;

    beforeAll(async () => {
        await connectDb();
        await connectRedis();

        // 1. Setup Fleet Manager
        const managerResult = await pool.query("SELECT id FROM fleet_managers WHERE work_email = 'manager@fleetops.dev'");
        const managerId = managerResult.rows[0].id;
        managerToken = jwt.sign({ id: managerId, role: 'fleet_manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // 2. Setup Drivers
        const hash = await bcrypt.hash('driverpass', 10);

        const driverAResult = await pool.query(
            "INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status) VALUES ($1, 'Driver A', 'drivera@test.com', 'DRV-A', $2, true) RETURNING id",
            [managerId, hash]
        );
        driverA_Id = driverAResult.rows[0].id;

        const driverBResult = await pool.query(
            "INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status) VALUES ($1, 'Driver B', 'driverb@test.com', 'DRV-B', $2, true) RETURNING id",
            [managerId, hash]
        );
        driverB_Id = driverBResult.rows[0].id;

        // 3. Authenticate Drivers (also sets their availability to 'available')
        const loginA = await request(app).post('/api/drivers/auth/login').send({ email: 'drivera@test.com', password: 'driverpass' });
        driverA_Token = loginA.body.token;

        const loginB = await request(app).post('/api/drivers/auth/login').send({ email: 'driverb@test.com', password: 'driverpass' });
        driverB_Token = loginB.body.token;

        // 4. Setup Vehicle
        const vehicleResult = await pool.query(
            "INSERT INTO vehicles (registration_number, type, capacity) VALUES ('V-TEST-DRV', 'sedan', 4) RETURNING id"
        );
        vehicleId = vehicleResult.rows[0].id;

        // 5. Create Trips
        const tripAResult = await pool.query(
            `INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time) 
             VALUES ('clienta@corp.com', 'Alice', 'Loc A', 'Dest A', NOW() + INTERVAL '1 day') RETURNING id`
        );
        tripA_Id = tripAResult.rows[0].id;

        const tripBResult = await pool.query(
            `INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time) 
             VALUES ('clientb@corp.com', 'Bob', 'Loc B', 'Dest B', NOW() + INTERVAL '1 day') RETURNING id`
        );
        tripB_Id = tripBResult.rows[0].id;

        // Assign Trips
        await request(app).patch(`/api/trips/${tripA_Id}/assign`).set('Authorization', `Bearer ${managerToken}`).send({ driver_id: driverA_Id, vehicle_id: vehicleId });
        await request(app).patch(`/api/trips/${tripB_Id}/assign`).set('Authorization', `Bearer ${managerToken}`).send({ driver_id: driverB_Id, vehicle_id: vehicleId });
    });

    afterAll(async () => {
        getIo().close();
        await new Promise((resolve) => httpServer.close(resolve));

        // Cleanup
        await pool.query('DELETE FROM trips WHERE id IN ($1, $2)', [tripA_Id, tripB_Id]);
        await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
        await pool.query('DELETE FROM drivers WHERE id IN ($1, $2)', [driverA_Id, driverB_Id]);

        await pool.end();
        await client.quit();
    });

    it('Test 1: Driver sees only own trips and Test 2: Data minimisation on trip view', async () => {
        const resA = await request(app)
            .get('/api/driver/trips')
            .set('Authorization', `Bearer ${driverA_Token}`);

        expect(resA.status).toBe(200);
        expect(resA.body).toHaveLength(1);
        expect(resA.body[0].id).toBe(tripA_Id);

        // Data Minimisation Verify: corporate email is stripped
        expect(resA.body[0].client_corporate_email).toBeUndefined();
        expect(resA.body[0].client_first_name).toBe('Alice');
    });

    it("Test 3: Driver cannot access another driver's trip", async () => {
        // Driver A tries to accept Driver B's trip
        const res = await request(app)
            .patch(`/api/driver/trips/${tripB_Id}/accept`)
            .set('Authorization', `Bearer ${driverA_Token}`);

        // Should return 404 because the trip is not assigned to Driver A
        expect(res.status).toBe(404);
    });

    it('Test 4: Driver accepts trip & tracking updates', async () => {
        const acceptRes = await request(app)
            .patch(`/api/driver/trips/${tripA_Id}/accept`)
            .set('Authorization', `Bearer ${driverA_Token}`);

        expect(acceptRes.status).toBe(200);
        expect(acceptRes.body.status).toBe('in_progress');

        // Verify Redis Session Data
        const driverSession = await getSession(`session:trip:${tripA_Id}:driver`);
        expect(driverSession.driver_id).toBe(driverA_Id);

        // Verify Availability tracking updated
        const avail = await getSession(`driver:availability:${driverA_Id}`);
        expect(avail.status).toBe('on_trip');
    });


    it('Test 5: Driver rejects trip & tracking updates', async () => {
        // Driver B rejects their trip
        const rejectRes = await request(app)
            .patch(`/api/driver/trips/${tripB_Id}/reject`)
            .set('Authorization', `Bearer ${driverB_Token}`)
            .send({ reason: 'Flat tire' });

        expect(rejectRes.status).toBe(200);
        expect(rejectRes.body.status).toBe('pending');
        expect(rejectRes.body.assigned_driver_id).toBeNull();

        // Verify Availability returned to available
        const avail = await getSession(`driver:availability:${driverB_Id}`);
        expect(avail.status).toBe('available');

        // Check audit log for REJECTED
        const auditRes = await pool.query("SELECT * FROM audit_log WHERE target_id = $1 AND action_type = 'TRIP_REJECTED'", [tripB_Id]);
        expect(auditRes.rows.length).toBe(1);
        expect(auditRes.rows[0].details.reason).toBe('Flat tire');
    });

    it('Test 6: Driver completes trip & cleanup', async () => {
        // Driver A completes trip A
        const completeRes = await request(app)
            .patch(`/api/driver/trips/${tripA_Id}/complete`)
            .set('Authorization', `Bearer ${driverA_Token}`);

        expect(completeRes.status).toBe(200);
        expect(completeRes.body.status).toBe('completed');

        // Verify Redis channels destroyed
        const driverSession = await getSession(`session:trip:${tripA_Id}:driver`);
        expect(driverSession).toBeNull();

        // Verify Complaint window created
        const complaintWindow = await getSession(`complaint:window:${tripA_Id}`);
        expect(complaintWindow.active).toBe(true);

        // Verify Availability returned to available
        const avail = await getSession(`driver:availability:${driverA_Id}`);
        expect(avail.status).toBe('available');
    });
});
