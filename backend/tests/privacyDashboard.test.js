// privacyDashboard.test.js
// This test validates the Privacy Dashboard as a live demonstration tool.
// It proves the dashboard accurately reflects ephemeral session state at every
// stage of the trip lifecycle — from assignment through acceptance, completion,
// and data destruction. This is the primary demonstration artifact for the
// research validation chapter.

import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import router from '../routes/index.js';
import { initIo, getIo } from '../socket/io.js';
import { registerDashboardNamespace } from '../socket/dashboardNamespace.js';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { jest } from '@jest/globals';

jest.setTimeout(30000); // Prevent 5000ms timeouts due to lingering postgres locks

const app = express();
app.use(express.json());
app.use(router);

let httpServer;
let io;

const API_DASHBOARD = '/api/dashboard';
const API_DRIVER = '/api/driver';

describe('Privacy Dashboard Lifecycle Validation', () => {
    let managerToken;
    let managerId;
    let driverToken;
    let mockDriverId;
    let mockVehicleId;
    let testTripId;

    beforeAll(async () => {
        await connectDb();
        await connectRedis();

        // Setup HTTP server and Socket.IO for the app (required for handlers to emit via getIo)
        httpServer = createServer(app);
        initIo(httpServer);
        registerDashboardNamespace(getIo());
        await new Promise((resolve) => httpServer.listen(0, resolve));

        // Clean up any specific collisions
        await pool.query("DELETE FROM trips WHERE client_corporate_email = 'dash.client.2@corp.com'");
        await pool.query("DELETE FROM vehicles WHERE registration_number = 'DASH-V2'");
        await pool.query("DELETE FROM drivers WHERE work_email = 'dashboard.driver.2@corp.com'");
        await pool.query("DELETE FROM fleet_managers WHERE work_email = 'dashboard.master.2@corp.com'");

        // Create Fleet Manager manually since test suite might not have this specific one
        let managerRes = await pool.query(`SELECT id FROM fleet_managers WHERE work_email = 'dashboard.master.2@corp.com'`);
        if (managerRes.rows.length === 0) {
            const hash = await bcrypt.hash('managerpass', 10);
            managerRes = await pool.query(`
                INSERT INTO fleet_managers (full_name, work_email, password_hash)
                VALUES ('Master', 'dashboard.master.2@corp.com', $1)
                RETURNING id`, [hash]);
        }
        managerId = managerRes.rows[0].id;

        // Login as Fleet Manager to get token
        const managerLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'dashboard.master.2@corp.com', password: 'managerpass', role: 'fleet_manager' })
            .expect(200);
        managerToken = managerLoginRes.body.token;

        // Setup Driver
        const driverHash = await bcrypt.hash('driverpass', 10);
        const driverRes = await pool.query(`
            INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status) 
            VALUES ($1, 'Dashboard Test Driver', 'dashboard.driver.2@corp.com', 'EMP-DASH-1-2', $2, true) 
            RETURNING id`, [managerId, driverHash]);
        mockDriverId = driverRes.rows[0].id;

        const vehicleRes = await pool.query(`
            INSERT INTO vehicles (registration_number, type, capacity) 
            VALUES ('DASH-V2', 'Sedan', 4) 
            RETURNING id`);
        mockVehicleId = vehicleRes.rows[0].id;

        // Login Driver to get token
        const loginRes = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'dashboard.driver.2@corp.com', password: 'driverpass' })
            .expect(200);
        driverToken = loginRes.body.token;

        // Create Trip and Assign Driver
        const tripCreationRes = await request(app)
            .post('/api/trips')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
                client_corporate_email: 'dash.client.2@corp.com',
                client_first_name: 'DashClient',
                pickup_location: 'Station A',
                destination: 'Station B',
                pickup_time: new Date(Date.now() + 86400000).toISOString()
            })
            .expect(201);
        testTripId = tripCreationRes.body.id;

        // Assign Driver (transitions trip to 'accepted')
        await request(app)
            .patch(`/api/trips/${testTripId}/assign`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ driver_id: mockDriverId, vehicle_id: mockVehicleId })
            .expect(200);
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            if (io) io.close();
            if (httpServer) {
                httpServer.close(resolve);
            } else {
                resolve();
            }
        });

        // Teardown
        await pool.query('DELETE FROM trips WHERE id = $1', [testTripId]);
        await pool.query('DELETE FROM vehicles WHERE id = $1', [mockVehicleId]);
        await pool.query('DELETE FROM drivers WHERE id = $1', [mockDriverId]);
        await pool.query('DELETE FROM fleet_managers WHERE id = $1', [managerId]);

        await pool.end();
        await client.quit();
    });

    it('Stage 1 — After assignment, before acceptance (Sessions Inactive)', async () => {
        const res = await request(app)
            .get(`${API_DASHBOARD}/trips/${testTripId}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        expect(res.body.status).toBe('accepted');
        expect(res.body.sessions.driver.active).toBe(false);
        expect(res.body.sessions.client.active).toBe(false);
        expect(res.body.sessions.complaint_window.active).toBe(false);
    });

    it('Stage 2 — After driver accepts (Sessions Active)', async () => {
        await request(app)
            .patch(`${API_DRIVER}/trips/${testTripId}/accept`)
            .set('Authorization', `Bearer ${driverToken}`)
            .expect(200);

        const res = await request(app)
            .get(`${API_DASHBOARD}/trips/${testTripId}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        expect(res.body.status).toBe('in_progress');
        expect(res.body.sessions.driver.active).toBe(true);
        expect(res.body.sessions.client.active).toBe(true);
        expect(res.body.sessions.driver.ttl_seconds).toBeGreaterThan(80000);
        expect(res.body.sessions.client.ttl_seconds).toBeGreaterThan(80000);
    });

    it('Stage 3 — After trip completion (Sessions Destroyed, Complaint Window Active)', async () => {

        // Transition: driver completes the trip
        await request(app)
            .patch(`${API_DRIVER}/trips/${testTripId}/complete`)
            .set('Authorization', `Bearer ${driverToken}`)
            .expect(200);

        const res = await request(app)
            .get(`${API_DASHBOARD}/trips/${testTripId}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        expect(res.body.status).toBe('completed');
        expect(res.body.sessions.driver.active).toBe(false);
        expect(res.body.sessions.client.active).toBe(false);
        expect(res.body.sessions.complaint_window.active).toBe(true);
        expect(res.body.sessions.complaint_window.ttl_seconds).toBeGreaterThan(0);
    });

    it('Stage 4 — Overview reflects system state (Destruction Metrics)', async () => {
        const res = await request(app)
            .get(`${API_DASHBOARD}/overview`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        expect(res.body.sessions_destroyed_today).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(res.body.trips)).toBe(true);
    });

    it('Stage 5 — Compliance report reflects completed trip (Data Minimization Proof)', async () => {
        const res = await request(app)
            .get(`${API_DASHBOARD}/compliance-report`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        expect(res.body).toHaveProperty('generated_at');
        expect(res.body).toHaveProperty('sessions');
        expect(res.body).toHaveProperty('data_lifecycle');
        expect(res.body).toHaveProperty('complaints');
        expect(res.body).toHaveProperty('audit_entries_total');

        expect(res.body.sessions.destroyed).toBeGreaterThanOrEqual(1);
        expect(res.body.data_lifecycle.trips_completed).toBeGreaterThanOrEqual(1);
    });
});
