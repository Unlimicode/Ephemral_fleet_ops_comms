import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import { initIo, getIo } from '../socket/io.js';
import { registerDashboardNamespace } from '../socket/dashboardNamespace.js';
import dashboardRouter from '../routes/dashboard.js';
import tripsRouter from '../routes/trips.js';

// Setup inline Express app to test the dashboard router
const app = express();
const httpServer = createServer(app);
initIo(httpServer);
registerDashboardNamespace(getIo());
app.use(express.json());
app.use('/api/dashboard', dashboardRouter);
app.use('/api/trips', tripsRouter);

const API = '/api/dashboard';
let managerToken = '';
let testTripId = '';
let port;

beforeAll(async () => {
    await connectDb();
    await connectRedis();

    await new Promise((resolve) => {
        httpServer.listen(() => {
            port = httpServer.address().port;
            resolve();
        });
    });

    // Generate token explicitly
    const managerRes = await pool.query(`SELECT id FROM fleet_managers LIMIT 1`);
    if (managerRes.rows.length === 0) {
        throw new Error('No fleet managers found in database. Seed data first.');
    }
    const managerId = managerRes.rows[0].id;
    managerToken = jwt.sign({ id: managerId, role: 'fleet_manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Create a trip directly using DB
    const tripRes = await pool.query(
        `INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, status)
         VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
        ['testclient@corp.com', 'TestClient', 'Location A', 'Location B', new Date(Date.now() + 86400000).toISOString()]
    );
    testTripId = tripRes.rows[0].id;
});

afterAll(async () => {
    // Cleanup DB
    await pool.query(`DELETE FROM trips WHERE id = $1`, [testTripId]);
    await pool.query(`DELETE FROM complaints WHERE trip_id = $1`, [testTripId]);
    await pool.query(`DELETE FROM audit_log WHERE target_id = $1`, [testTripId]);

    // Cleanup Redis
    if (testTripId) {
        await client.del(`session:trip:${testTripId}:driver`);
        await client.del(`session:trip:${testTripId}:client`);
        await client.del(`messages:trip:${testTripId}`);
        await client.del(`complaint:window:${testTripId}`);
    }

    if (getIo()) getIo().close();
    await new Promise((resolve) => httpServer.close(resolve));

    await client.quit();
    await pool.end();
});

describe('Dashboard Socket.IO Namespace', () => {
    it('Dashboard namespace rejects unauthorised connection', async () => {
        const attackerSocket = Client(`http://localhost:${port}/dashboard`, {
            auth: { token: 'invalid_token' }
        });

        const errorMsg = await new Promise((resolve, reject) => {
            attackerSocket.on('auth_error', resolve);
            setTimeout(() => reject(new Error('Timeout waiting for auth_error')), 2000);
        });

        expect(errorMsg).toBe('Unauthorised');
        attackerSocket.disconnect();
    });
});

describe('Privacy Dashboard API', () => {

    it('Scenario 1: Session state during active trip', async () => {
        // Setup active session states for the trip manually
        const driverId = '00000000-0000-0000-0000-000000000000'; // mock uuid
        await pool.query(`UPDATE trips SET status = 'in_progress' WHERE id = $1`, [testTripId]);
        await client.set(`session:trip:${testTripId}:driver`, JSON.stringify({ driver_id: driverId }), { EX: 86400 });
        await client.set(`session:trip:${testTripId}:client`, JSON.stringify({ email: 'testclient@corp.com' }), { EX: 86400 });

        // Add a message to the buffer
        await client.rPush(`messages:trip:${testTripId}`, JSON.stringify({ from: 'driver', content: 'test', timestamp: new Date().toISOString() }));
        await client.expire(`messages:trip:${testTripId}`, 86400);

        const res = await request(app)
            .get(`${API}/trips/${testTripId}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        expect(res.body.trip_id).toBe(testTripId);
        expect(res.body.sessions.driver.active).toBe(true);
        expect(res.body.sessions.driver.ttl_seconds).toBeGreaterThan(0);
        expect(res.body.sessions.client.active).toBe(true);
        expect(res.body.sessions.client.ttl_seconds).toBeGreaterThan(0);
        expect(res.body.sessions.message_buffer.active).toBe(true);
        expect(res.body.sessions.message_buffer.message_count).toBe(1);
        expect(res.body.sessions.complaint_window.active).toBe(false);
        expect(res.body.complaint_filed).toBe(false);
    });

    it('Scenario 4: Overview reflects active trips', async () => {
        const res = await request(app)
            .get(`${API}/overview`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        expect(res.body.active_trips).toBeGreaterThanOrEqual(1);
        expect(res.body.active_driver_sessions).toBeGreaterThanOrEqual(1);

        const activeTrip = res.body.trips.find(t => t.trip_id === testTripId);
        expect(activeTrip).toBeDefined();
        expect(activeTrip.status).toBe('in_progress');
        expect(activeTrip.driver_session_active).toBe(true);
        expect(activeTrip.client_session_active).toBe(true);
    });

    it('Scenario 2: Session state after trip completion', async () => {
        // Complete the trip manually in DB/Redis
        await pool.query(`UPDATE trips SET status = 'completed' WHERE id = $1`, [testTripId]);

        await client.del(`session:trip:${testTripId}:driver`);
        await client.del(`session:trip:${testTripId}:client`);
        await client.del(`messages:trip:${testTripId}`);
        await client.set(`complaint:window:${testTripId}`, JSON.stringify({ trip_id: testTripId }), { EX: 86400 });

        // Mock the session destroyed audit log for overview
        await pool.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['TRIP_SESSION_DESTROYED', '00000000-0000-0000-0000-000000000000', 'fleet_manager', testTripId, {}]
        );

        const res = await request(app)
            .get(`${API}/trips/${testTripId}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        expect(res.body.sessions.driver.active).toBe(false);
        expect(res.body.sessions.driver.ttl_seconds).toBeNull();
        expect(res.body.sessions.client.active).toBe(false);
        expect(res.body.sessions.client.ttl_seconds).toBeNull();
        expect(res.body.sessions.message_buffer.active).toBe(false);
        expect(res.body.sessions.complaint_window.active).toBe(true);
        expect(res.body.sessions.complaint_window.ttl_seconds).toBeGreaterThan(0);
    });

    it('Scenario 5: Overview reflects destroyed sessions', async () => {
        const res = await request(app)
            .get(`${API}/overview`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        // We explicitly inserted 1 above, plus other tests might have run, so >= 1
        expect(res.body.sessions_destroyed_today).toBeGreaterThanOrEqual(1);
    });

    it('Scenario 3: Session state after complaint filed', async () => {
        // File a complaint
        await pool.query(
            `INSERT INTO complaints (trip_id, category, description, status) 
             VALUES ($1, 'Safety', 'Test complaint', 'open')`,
            [testTripId]
        );

        const res = await request(app)
            .get(`${API}/trips/${testTripId}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        expect(res.body.complaint_filed).toBe(true);
    });

});
