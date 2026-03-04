import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import router from '../routes/index.js';
import bcrypt from 'bcryptjs';
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

        // Login to acquire a token
        const loginRes = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'push.driver@test.com', password: 'pushpassword' });
        driverToken = loginRes.body.token;
    });

    afterAll(async () => {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [MOCK_ENDPOINT]);
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
});
