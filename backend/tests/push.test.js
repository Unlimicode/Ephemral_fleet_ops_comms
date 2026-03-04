import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import webpush from 'web-push';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import router from '../routes/index.js';
import { sendPushNotification } from '../utils/sendPushNotification.js';
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
app.use(router);

const API_PUSH = '/api/push';
const MOCK_ENDPOINT = 'https://mock-push-service.example.com/unique-endpoint-push-test';

describe('Push Subscription Endpoints', () => {
    let driverToken;
    let driverId;
    let managerToken;
    let vehicleId;
    let tripId;

    beforeAll(async () => {
        await connectDb();
        await connectRedis();

        // Cleanup from previous runs
        await pool.query(
            'DELETE FROM push_subscriptions WHERE endpoint = $1',
            [MOCK_ENDPOINT]
        );
        await pool.query("DELETE FROM drivers WHERE work_email = 'push.driver@test.com'");

        // Seed a fleet manager if not present
        let managerRes = await pool.query(
            "SELECT id FROM fleet_managers WHERE work_email = 'manager@fleetops.dev'"
        );
        if (managerRes.rows.length === 0) {
            throw new Error('Seeded fleet manager not found. Run seedData.js first.');
        }
        const managerId = managerRes.rows[0].id;

        // Seed a driver for this suite
        const driverHash = await bcrypt.hash('pushpassword', 10);
        const driverRes = await pool.query(
            `INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status)
             VALUES ($1, 'Push Test Driver', 'push.driver@test.com', 'EMP-PUSH-001', $2, true)
             RETURNING id`,
            [managerId, driverHash]
        );
        driverId = driverRes.rows[0].id;

        // Generate a manager JWT for the assignment test
        managerToken = jwt.sign(
            { id: managerId, role: 'fleet_manager' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Seed a vehicle for the assignment test
        await pool.query("DELETE FROM vehicles WHERE registration_number = 'PUSH-VH-001'");
        const vehicleRes = await pool.query(
            `INSERT INTO vehicles (registration_number, type, capacity)
             VALUES ('PUSH-VH-001', 'Sedan', 4)
             RETURNING id`
        );
        vehicleId = vehicleRes.rows[0].id;

        // Seed a pending trip for the assignment test
        await pool.query("DELETE FROM trips WHERE client_corporate_email = 'push.client@corp.com'");
        const tripRes = await pool.query(
            `INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time)
             VALUES ('push.client@corp.com', 'PushClient', 'Terminal 1', 'City Centre', NOW() + INTERVAL '2 hours')
             RETURNING id`
        );
        tripId = tripRes.rows[0].id;

        // Login to acquire a driver token
        const loginRes = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'push.driver@test.com', password: 'pushpassword' });
        driverToken = loginRes.body.token;
    });

    afterAll(async () => {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [MOCK_ENDPOINT]);
        if (tripId) await pool.query('DELETE FROM trips WHERE id = $1', [tripId]);
        if (vehicleId) await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
        if (driverId) await pool.query('DELETE FROM drivers WHERE id = $1', [driverId]);
        await client.quit();
        await pool.end();
    });

    it('VAPID public key returned', async () => {
        const res = await request(app)
            .get(`${API_PUSH}/vapid-public-key`)
            .expect(200);

        expect(typeof res.body.publicKey).toBe('string');
        expect(res.body.publicKey.length).toBeGreaterThan(0);
    });

    it('Driver can register push subscription', async () => {
        const res = await request(app)
            .post(`${API_PUSH}/subscribe`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({
                endpoint: MOCK_ENDPOINT,
                keys: {
                    p256dh: 'mockp256dh',
                    auth: 'mockauth',
                },
            })
            .expect(201);

        expect(res.body.message).toBe('Push subscription registered.');
    });

    it('Driver can remove push subscription', async () => {
        const res = await request(app)
            .delete(`${API_PUSH}/subscribe`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ endpoint: MOCK_ENDPOINT })
            .expect(200);

        expect(res.body.message).toBe('Push subscription removed.');

        // Confirm the row no longer exists in the database
        const check = await pool.query(
            'SELECT id FROM push_subscriptions WHERE endpoint = $1',
            [MOCK_ENDPOINT]
        );
        expect(check.rows.length).toBe(0);
    });

    it('Push notification sent on trip assignment does not block assignment', async () => {
        // Register a mock subscription — the endpoint is not a real push service
        // so webpush will fail, but the assignment must still return 200.
        await request(app)
            .post(`${API_PUSH}/subscribe`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ endpoint: MOCK_ENDPOINT, keys: { p256dh: 'mockp256dh', auth: 'mockauth' } })
            .expect(201);

        const res = await request(app)
            .patch(`/api/trips/${tripId}/assign`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ driver_id: driverId, vehicle_id: vehicleId })
            .expect(200);

        expect(res.body.status).toBe('accepted');
    });

    it('Expired subscription is deleted after 410 response from push service', async () => {
        // Monkey-patch webpush.sendNotification to simulate a 410 response from a push service.
        // Both this test file and sendPushNotification.js import 'web-push' from the same ESM
        // module instance, so patching the method here affects the call inside the utility.
        // A 404 or 410 statusCode signals the subscription is invalid and must be deleted.
        const original = webpush.sendNotification.bind(webpush);
        webpush.sendNotification = async () => {
            const err = new Error('Subscription expired');
            err.statusCode = 410;
            throw err;
        };

        // Remove all existing subscriptions for the driver and insert one expired row.
        await pool.query('DELETE FROM push_subscriptions WHERE driver_id = $1', [driverId]);
        const expiredEndpoint = 'https://expired-push-endpoint.example.com/push/test-cleanup';
        await pool.query(
            `INSERT INTO push_subscriptions (driver_id, endpoint, p256dh, auth)
             VALUES ($1, $2, 'stub_p256dh', 'stub_auth')
             ON CONFLICT (endpoint) DO NOTHING`,
            [driverId, expiredEndpoint]
        );

        try {
            // sendPushNotification calls webpush.sendNotification, receives 410, and deletes the row.
            await sendPushNotification(driverId, { title: 'Test', body: 'Cleanup test' });
        } finally {
            // Restore the original to avoid affecting other suites.
            webpush.sendNotification = original;
        }

        const check = await pool.query(
            'SELECT id FROM push_subscriptions WHERE endpoint = $1',
            [expiredEndpoint]
        );
        expect(check.rows.length).toBe(0);
    });
});
