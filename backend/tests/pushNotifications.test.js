// pushNotifications.test.js
// Validates the complete push notification lifecycle including subscription
// registration, upsert on refresh, delivery attempts on key system events,
// graceful failure handling, and subscription removal.
// Push delivery itself cannot be tested without a real browser push service —
// these tests validate the subscription management layer and confirm that
// push failures never block core system operations.

import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import { setSession } from '../config/redisHelpers.js';
import router from '../routes/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { initIo } from '../socket/io.js';
import { jest } from '@jest/globals';

jest.setTimeout(30000);

const app = express();
const httpServer = createServer(app);
initIo(httpServer);
app.use(express.json());
app.use(cookieParser());
app.use(router);

const MOCK_ENDPOINT = 'https://mock-push.example.com/test-endpoint-8-4';

describe('Push Notification Lifecycle', () => {
    let managerId;
    let managerToken;
    let driverId;
    let driverToken;
    let vehicleId;
    let assignedTripId;
    let completedTripId;
    let complaintId;

    beforeAll(async () => {
        await connectDb();
        await connectRedis();

        // Defensive cleanup from previous runs.
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [MOCK_ENDPOINT]);
        await pool.query("DELETE FROM drivers WHERE work_email = 'push-lifecycle.driver@test.com'");
        await pool.query("DELETE FROM vehicles WHERE registration_number = 'PUSH-LC-001'");

        // Resolve the seeded fleet manager required for all token and resource operations.
        const managerRes = await pool.query(
            "SELECT id FROM fleet_managers WHERE work_email = 'manager@fleetops.dev'"
        );
        if (managerRes.rows.length === 0) {
            throw new Error('Seeded fleet manager not found. Run seedData.js first.');
        }
        managerId = managerRes.rows[0].id;
        managerToken = jwt.sign(
            { id: managerId, role: 'fleet_manager' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Seed the test driver and obtain a JWT via the login endpoint.
        const driverHash = await bcrypt.hash('lc-driver-pass', 10);
        const driverRes = await pool.query(
            `INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status)
             VALUES ($1, 'LC Push Driver', 'push-lifecycle.driver@test.com', 'EMP-LC-001', $2, true)
             RETURNING id`,
            [managerId, driverHash]
        );
        driverId = driverRes.rows[0].id;

        const loginRes = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'push-lifecycle.driver@test.com', password: 'lc-driver-pass' });
        driverToken = loginRes.body.token;

        // Seed a vehicle used for the trip assignment test.
        const vehicleRes = await pool.query(
            `INSERT INTO vehicles (registration_number, type, capacity)
             VALUES ('PUSH-LC-001', 'Sedan', 4)
             RETURNING id`
        );
        vehicleId = vehicleRes.rows[0].id;

        // Seed a pending trip for Test 3 (assignment trigger).
        const pendingTripRes = await pool.query(
            `INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time)
             VALUES ('lc.client@corp.com', 'LCClient', 'HQ', 'Airport', NOW() + INTERVAL '1 hour')
             RETURNING id`
        );
        assignedTripId = pendingTripRes.rows[0].id;

        // Seed a completed trip for Test 4 (complaint trigger).
        // The complaint filing endpoint requires trip status = 'completed' and an assigned_driver_id.
        const completedTripRes = await pool.query(
            `INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination,
             pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ('lc.completed@corp.com', 'LCDone', 'Station', 'Hotel', NOW(), 'completed', $1, $2)
             RETURNING id`,
            [driverId, vehicleId]
        );
        completedTripId = completedTripRes.rows[0].id;

        // Register the mock push subscription used by Tests 1, 2, 3, and 4.
        await request(app)
            .post('/api/push/subscribe')
            .set('Authorization', `Bearer ${driverToken}`)
            .send({
                endpoint: MOCK_ENDPOINT,
                keys: { p256dh: 'mockp256dhvalue', auth: 'mockauthvalue' },
            })
            .expect(201);
    });

    afterAll(async () => {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [MOCK_ENDPOINT]);
        await pool.query('DELETE FROM complaints WHERE trip_id = $1', [completedTripId]);
        await pool.query('DELETE FROM trips WHERE id IN ($1, $2)', [assignedTripId, completedTripId]);
        await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
        await pool.query('DELETE FROM drivers WHERE id = $1', [driverId]);
        await client.quit();
        await pool.end();
    });

    it('Test 1: Subscription registered in database', async () => {
        const res = await pool.query(
            'SELECT driver_id, endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = $1',
            [MOCK_ENDPOINT]
        );
        expect(res.rows.length).toBe(1);
        expect(res.rows[0].driver_id).toBe(driverId);
        expect(res.rows[0].p256dh).toBe('mockp256dhvalue');
        expect(res.rows[0].auth).toBe('mockauthvalue');
    });

    it('Test 2: Subscription upsert handles refresh', async () => {
        const subscribeRes = await request(app)
            .post('/api/push/subscribe')
            .set('Authorization', `Bearer ${driverToken}`)
            .send({
                endpoint: MOCK_ENDPOINT,
                keys: { p256dh: 'updatedp256dhvalue', auth: 'mockauthvalue' },
            });
        expect(subscribeRes.status).toBe(201);

        const dbRes = await pool.query(
            'SELECT p256dh FROM push_subscriptions WHERE endpoint = $1',
            [MOCK_ENDPOINT]
        );
        // The upsert must update the existing row — no duplicate created.
        expect(dbRes.rows.length).toBe(1);
        expect(dbRes.rows[0].p256dh).toBe('updatedp256dhvalue');
    });

    it('Test 3: Trip assignment triggers push attempt without blocking assignment', async () => {
        const res = await request(app)
            .patch(`/api/trips/${assignedTripId}/assign`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ driver_id: driverId, vehicle_id: vehicleId });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('accepted');

        // The push delivery attempt fails (mock endpoint) but the assignment completes.
        // The audit_log entry confirms the assignment reached the database despite the push failure.
        const auditRes = await pool.query(
            `SELECT id FROM audit_log
             WHERE action_type = 'TRIP_ASSIGNED'
               AND target_id = $1`,
            [assignedTripId]
        );
        expect(auditRes.rows.length).toBe(1);
    });

    it('Test 4: Complaint review triggers push attempt without blocking status update', async () => {
        // Build a client session JWT — requireClientAuth reads the 'client_session' cookie.
        const clientToken = jwt.sign(
            { tripId: completedTripId, role: 'client' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        const clientCookie = `client_session=${clientToken}`;

        // Seed the complaint filing window in Redis.
        await setSession(`complaint:window:${completedTripId}`, { active: true }, 86400);

        // File the complaint via the authenticated client session.
        const complaintRes = await request(app)
            .post(`/api/complaints/${completedTripId}`)
            .set('Cookie', clientCookie)
            .send({ category: 'safety', description: 'Unsafe driving observed.' });
        expect(complaintRes.status).toBe(201);
        complaintId = complaintRes.body.complaint_id;

        // Set complaint status to under_investigation — triggers push to the assigned driver.
        const reviewRes = await request(app)
            .patch(`/api/complaints/${complaintId}/status`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ status: 'under_investigation' });

        expect(reviewRes.status).toBe(200);
        expect(reviewRes.body.status).toBe('under_investigation');
    });

    it('Test 5: Subscription removed on unsubscribe', async () => {
        const res = await request(app)
            .delete('/api/push/subscribe')
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ endpoint: MOCK_ENDPOINT });

        expect(res.status).toBe(200);

        const dbRes = await pool.query(
            'SELECT id FROM push_subscriptions WHERE endpoint = $1',
            [MOCK_ENDPOINT]
        );
        expect(dbRes.rows.length).toBe(0);
    });

    it('Test 6: Unauthorised subscription attempt rejected', async () => {
        const res = await request(app)
            .post('/api/push/subscribe')
            .send({
                endpoint: MOCK_ENDPOINT,
                keys: { p256dh: 'anyvalue', auth: 'anyauth' },
            });
        expect(res.status).toBe(401);
    });
});
