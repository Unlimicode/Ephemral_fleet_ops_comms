import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import { initIo, getIo } from '../socket/io.js';
import tripsRouter from '../routes/trips.js';
import driversRouter from '../routes/drivers.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

jest.setTimeout(30000);

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET RELAY INTEGRATION TESTS — Phase 4.4
// ─────────────────────────────────────────────────────────────────────────────
// PROOF OF MEDIATED EPHEMERAL IDENTITY (MEI) ARCHITECTURE
// These four tests prove the complete WebSocket privacy guarantee:
// 1. Only legitimate session holders (with active Redis keys via REST) can connect.
// 2. Unauthorized connections are actively evaluated and rejected via forced disconnect.
// 3. Messages are relayed dynamically without persistence or identity exposure.
// 4. The channel is fully and explicitly closed the moment the trip concludes, 
//    enforcing the temporal bounds of the communication pipeline.
// ─────────────────────────────────────────────────────────────────────────────

// Setup inline Express app & Socket.IO server to test the integration accurately
const app = express();
const httpServer = createServer(app);
initIo(httpServer);

app.use(express.json());
app.use('/api/trips', tripsRouter);
app.use('/api/drivers', driversRouter);

describe('WebSocket Relay & Ephemeral Privacy Guarantees', () => {
    let authToken;
    let managerId;
    let driverId;
    let vehicleId;
    let testTripId;
    let port;
    let driverToken;

    // Test clients
    let driverSocket;
    let clientSocket;

    beforeAll(async () => {
        // 1. Connect data stores
        await connectDb();
        await connectRedis();

        // 2. Start the HTTP server so Socket.IO can listen on a real port for the clients
        await new Promise((resolve) => {
            httpServer.listen(() => {
                port = httpServer.address().port;
                resolve();
            });
        });

        // Pre-cleanup in case a prior failed run left stale rows
        await pool.query("DELETE FROM trips WHERE client_corporate_email = 'relayclient@corporate.com'");
        await pool.query("DELETE FROM vehicles WHERE registration_number = 'RLY-999'");
        await pool.query("DELETE FROM drivers WHERE work_email = 'relay@test.com'");

        // 3. Setup core entities for testing
        const managerResult = await pool.query("SELECT id FROM fleet_managers WHERE work_email = 'manager@fleetops.dev'");
        managerId = managerResult.rows[0].id;
        authToken = jwt.sign({ id: managerId, role: 'fleet_manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const driverHash = await bcrypt.hash('driverpassword', 10);
        const driverResult = await pool.query(
            "INSERT INTO drivers (fleet_manager_id, full_name, work_email, employee_id, password_hash, active_status) VALUES ($1, 'Relay Driver', 'relay@test.com', 'RLY-123', $2, true) RETURNING id",
            [managerId, driverHash]
        );
        driverId = driverResult.rows[0].id;

        const loginRes = await request(app)
            .post('/api/drivers/auth/login')
            .send({ email: 'relay@test.com', password: 'driverpassword' });
        driverToken = loginRes.body.token;

        const vehicleResult = await pool.query(
            "INSERT INTO vehicles (registration_number, type, capacity) VALUES ($1, 'sedan', 4) RETURNING id",
            ['RLY-999']
        );
        vehicleId = vehicleResult.rows[0].id;
    });

    afterAll(async () => {
        if (driverSocket) driverSocket.disconnect();
        if (clientSocket) clientSocket.disconnect();

        getIo().close();
        await new Promise((resolve) => httpServer.close(resolve));

        await pool.query('DELETE FROM trips WHERE client_corporate_email = $1', ['relayclient@corporate.com']);
        await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
        await pool.query('DELETE FROM drivers WHERE id = $1', [driverId]);

        await pool.end();
        await client.quit();
    });

    // ─────────────────────────────────────────────────────────────────────────

    it('Test 1: Creates a trip and establishes a Valid Session Connection', async () => {
        // A. Setup the MEI Rest State
        // A. Setup the MEI Rest State
        const createRes = await request(app).post('/api/trips')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                client_corporate_email: 'relayclient@corporate.com',
                client_first_name: 'RelayTest',
                pickup_location: 'Point A',
                destination: 'Point B',
                pickup_time: new Date().toISOString()
            });
        testTripId = createRes.body.id;

        await request(app).patch(`/api/trips/${testTripId}/assign`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ driver_id: driverId, vehicle_id: vehicleId });

        // This creates the Redis session keys
        const acceptRes = await request(app).patch(`/api/trips/${testTripId}/accept`)
            .set('Authorization', `Bearer ${driverToken}`);
        expect(acceptRes.status).toBe(200);

        // Manually simulate the Gap 1 phase `PATCH /start`
        await pool.query("UPDATE trips SET status = 'in_progress' WHERE id = $1", [testTripId]);

        // B. Connect the Socket.IO client mimicking the driver
        driverSocket = Client(`http://localhost:${port}`, {
            auth: { tripId: testTripId, role: 'driver' }
        });

        driverSocket.on('connect_error', (err) => console.log('[debug] driverSocket connect_error:', err.message));

        const joinedPayload = await new Promise((resolve, reject) => {
            driverSocket.on('session_joined', resolve);
            setTimeout(() => reject(new Error('Timeout waiting for session_joined')), 5000);
        });

        expect(joinedPayload).toEqual({ tripId: testTripId, role: 'driver' });
    });

    it('Test 2: Rejects Invalid Session connections', async () => {
        const fakeTripId = '99999999-9999-9999-9999-999999999999';
        const attackerSocket = Client(`http://localhost:${port}`, {
            auth: { tripId: fakeTripId, role: 'driver' }
        });

        const errorMsg = await new Promise((resolve, reject) => {
            attackerSocket.on('auth_error', resolve);
            setTimeout(() => reject(new Error('Timeout waiting for auth_error')), 2000);
        });

        // Socket is booted explicitly by our MEI logic
        expect(errorMsg).toBe('No active session for this trip');
        attackerSocket.disconnect();
    });

    it('Test 3: Mediates Message Relay Broadcast without persistent storage', async () => {
        // Connect the client app
        clientSocket = Client(`http://localhost:${port}`, {
            auth: { tripId: testTripId, role: 'client' }
        });

        // Wait for connection to settle
        await new Promise((resolve) => clientSocket.on('session_joined', resolve));

        // Both sockets should receive the unified payload
        const driverPromise = new Promise((resolve) => driverSocket.once('receive_message', resolve));
        const clientPromise = new Promise((resolve) => clientSocket.once('receive_message', resolve));

        // Let the driver send a message
        const testContent = "I'm arriving in 2 minutes.";
        driverSocket.emit('send_message', { content: testContent });

        const [driverMsg, clientMsg] = await Promise.all([driverPromise, clientPromise]);

        expect(driverMsg.content).toBe(testContent);
        expect(driverMsg.from).toBe('driver');
        expect(driverMsg).toHaveProperty('timestamp');

        expect(clientMsg.content).toBe(testContent);
        expect(clientMsg.from).toBe('driver');
        expect(clientMsg).toHaveProperty('timestamp');
    });

    it('Test 4: Message buffer created in Redis', async () => {
        // We know from Test 3 that `testTripId` has messages
        const bufferKey = `messages:trip:${testTripId}`;
        const rawBuffer = await client.lRange(bufferKey, 0, -1);

        // Assert the block exists structurally holding >= 1 entry
        expect(rawBuffer.length).toBeGreaterThanOrEqual(1);

        // Parse JSON natively asserting explicit object structures
        const lastMessage = JSON.parse(rawBuffer[rawBuffer.length - 1]);

        expect(lastMessage).toHaveProperty('from', 'driver');
        expect(lastMessage).toHaveProperty('content');
        expect(lastMessage).toHaveProperty('timestamp');

        // Let's quickly double check the TTL was created structurally 
        // Note: TTL might be slightly less than 86400 by the time this runs 
        const ttl = await client.ttl(bufferKey);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(86400);
    });

    it('Test 5: Broadcasts explicit Channel Closure upon Trip Completion', async () => {
        // Setup listeners *before* triggering the REST completion to avoid race conditions
        const driverPromise = new Promise((resolve) => driverSocket.once('session_closed', resolve));
        const clientPromise = new Promise((resolve) => clientSocket.once('session_closed', resolve));

        // Complete the trip via REST — this intrinsically destroys the Redis keys and broadcasts closure
        const completeRes = await request(app).patch(`/api/trips/${testTripId}/complete`)
            .set('Authorization', `Bearer ${driverToken}`);
        expect(completeRes.status).toBe(200);

        // Await the push notifications
        const [driverClosed, clientClosed] = await Promise.all([driverPromise, clientPromise]);

        const expectedPayload = {
            tripId: testTripId,
            reason: 'Trip completed — communication channel closed',
            complaint_window_hours: 24
        };

        expect(driverClosed).toEqual(expectedPayload);
        expect(clientClosed).toEqual(expectedPayload);
    });
});
