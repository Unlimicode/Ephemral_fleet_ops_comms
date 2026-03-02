import { jest } from '@jest/globals';
import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import { setSession } from '../config/redisHelpers.js';
import complaintsRouter from '../routes/complaints.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────────────────────
// PROOF OF ARCHITECTURE: Time-Bound Anonymous Feedback Windows
// ─────────────────────────────────────────────────────────────────────────────
// These tests prove the complaint window is enforced by Redis TTL as a technical 
// constraint — not by application logic checking timestamps — and that cross-client 
// access is structurally prevented by matching the cookie session to the requested trip.
// ─────────────────────────────────────────────────────────────────────────────

jest.setTimeout(25000);

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(cookieParser());
app.use('/api/complaints', complaintsRouter);

describe('Complaint Lodgment API', () => {
    let managerToken;
    let managerId;
    let mockDriverId;
    let mockVehicleId;
    let tripA_Id;
    let tripB_Id;
    let clientA_Cookie;
    let clientB_Cookie;

    beforeAll(async () => {
        await connectDb();
        await connectRedis();

        // 1. Setup Fleet Manager
        const hash = await bcrypt.hash('complaintpass', 10);
        const managerResult = await pool.query(
            "INSERT INTO fleet_managers (full_name, work_email, password_hash) VALUES ('Admin C', 'admin.c@corp.com', $1) RETURNING id",
            [hash]
        );
        managerId = managerResult.rows[0].id;
        managerToken = jwt.sign({ id: managerId, role: 'fleet_manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // 2. Setup Mock Driver
        const driverHash = await bcrypt.hash('driverpass', 10);
        const driverRes = await pool.query(
            "INSERT INTO drivers (fleet_manager_id, full_name, work_email, password_hash, employee_id) VALUES ($1, 'D1', 'd1@corp.com', $2, 'D-101') RETURNING id",
            [managerId, driverHash]
        );
        mockDriverId = driverRes.rows[0].id;

        // 3. Setup Mock Vehicle
        const vehRes = await pool.query(
            "INSERT INTO vehicles (registration_number, type, capacity) VALUES ('V-COMP', 'SUV', 4) RETURNING id"
        );
        mockVehicleId = vehRes.rows[0].id;

        // 4. Setup Completed Trips
        const tripARes = await pool.query(
            "INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id) VALUES ('clientA@corp.com', 'Client A', 'P1', 'D1', NOW(), 'completed', $1, $2) RETURNING id",
            [mockDriverId, mockVehicleId]
        );
        tripA_Id = tripARes.rows[0].id;

        const tripBRes = await pool.query(
            "INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id) VALUES ('clientB@corp.com', 'Client B', 'P2', 'D2', NOW(), 'completed', $1, $2) RETURNING id",
            [mockDriverId, mockVehicleId]
        );
        tripB_Id = tripBRes.rows[0].id;

        // 5. Generate Client Cookies
        const tokenA = jwt.sign({ tripId: tripA_Id, role: 'client' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        clientA_Cookie = `client_session=${tokenA}`;

        const tokenB = jwt.sign({ tripId: tripB_Id, role: 'client' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        clientB_Cookie = `client_session=${tokenB}`;

        // 6. Instantiate Redis Bounds
        await setSession(`complaint:window:${tripA_Id}`, { active: true }, 86400);
        await setSession(`complaint:window:${tripB_Id}`, { active: true }, 86400);
    });

    afterAll(async () => {
        await new Promise((resolve) => httpServer.close(resolve));

        // Cleanup Native Resources
        await pool.query('DELETE FROM complaints');
        await pool.query('DELETE FROM trips WHERE id IN ($1, $2)', [tripA_Id, tripB_Id]);
        await pool.query('DELETE FROM vehicles WHERE id = $1', [mockVehicleId]);
        await pool.query('DELETE FROM drivers WHERE id = $1', [mockDriverId]);
        await pool.query('DELETE FROM fleet_managers WHERE id = $1', [managerId]);

        await pool.end();
        await client.quit();
    });

    it('Test 1: Complaint filed within window', async () => {
        const res = await request(app)
            .post(`/api/complaints/${tripA_Id}`)
            .set('Cookie', clientA_Cookie)
            .send({
                category: 'professionalism',
                description: 'Driver was rude.'
            });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Complaint filed successfully.');
        expect(res.body).toHaveProperty('complaint_id');
    });

    it('Test 2: Complaint window closed', async () => {
        // Explicitly terminate the structure mimicking a native TTL expiry block
        await client.del(`complaint:window:${tripB_Id}`);

        const res = await request(app)
            .post(`/api/complaints/${tripB_Id}`)
            .set('Cookie', clientB_Cookie)
            .send({
                category: 'safety',
                description: 'Driver was speeding.'
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Complaint window closed or trip invalid');
    });

    it('Test 3: Cross-client access prevented', async () => {
        const res = await request(app)
            .post(`/api/complaints/${tripB_Id}`)
            .set('Cookie', clientA_Cookie) // Trying to file against trip B using cookie A
            .send({
                category: 'cleanliness',
                description: 'Vehicle was dirty.'
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied');
    });

    it('Test 4: Fleet manager can view complaints', async () => {
        const res = await request(app)
            .get('/api/complaints')
            .set('Authorization', `Bearer ${managerToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);

        const complaint = res.body.find(c => c.trip_id === tripA_Id);
        expect(complaint).toBeDefined();
        expect(complaint.category).toBe('professionalism');
        expect(complaint.description).toBe('Driver was rude.');
        // Verify encrypted_message_archive is not returned natively
        expect(complaint.encrypted_message_archive).toBeUndefined();
    });
});
