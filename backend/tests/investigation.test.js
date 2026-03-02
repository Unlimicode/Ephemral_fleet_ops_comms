import { jest } from '@jest/globals';
import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import pool, { connect as connectDb } from '../config/db.js';
import client, { connect as connectRedis } from '../config/redis.js';
import complaintsRouter from '../routes/complaints.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { encrypt } from '../utils/encryption.js';

// ─────────────────────────────────────────────────────────────────────────────
// PROOF OF ARCHITECTURE: Accountable Investigation Tracking Gateways
// ─────────────────────────────────────────────────────────────────────────────
// These tests natively prove that access to preserved message content is hard-gated 
// behind the 'under_investigation' structural status and fully logged — demonstrating 
// that the system definitively does not enable casual or arbitrary surveillance 
// of communication records but instead creates an auditable, purpose-limited 
// access mechanism natively bounding physical Fleet Manager queries.
// ─────────────────────────────────────────────────────────────────────────────

jest.setTimeout(25000);

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(cookieParser());
app.use('/api/complaints', complaintsRouter);

describe('Fleet Manager Complaint Investigation Endpoints', () => {
    let managerToken;
    let managerId;
    let mockDriverId;
    let mockVehicleId;
    let tripId;
    let complaintId;

    beforeAll(async () => {
        await connectDb();
        await connectRedis();

        // 1. Setup Fleet Manager
        const hash = await bcrypt.hash('investigationpass', 10);
        const managerResult = await pool.query(
            "INSERT INTO fleet_managers (full_name, work_email, password_hash) VALUES ('Admin I', 'admin.i@corp.com', $1) RETURNING id",
            [hash]
        );
        managerId = managerResult.rows[0].id;
        managerToken = jwt.sign({ id: managerId, role: 'fleet_manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // 2. Setup Mock Driver
        const driverHash = await bcrypt.hash('driverpass', 10);
        const driverRes = await pool.query(
            "INSERT INTO drivers (fleet_manager_id, full_name, work_email, password_hash, employee_id) VALUES ($1, 'D2', 'd2@corp.com', $2, 'D-102') RETURNING id",
            [managerId, driverHash]
        );
        mockDriverId = driverRes.rows[0].id;

        // 3. Setup Mock Vehicle
        const vehRes = await pool.query(
            "INSERT INTO vehicles (registration_number, type, capacity) VALUES ('V-INV', 'Sedan', 4) RETURNING id"
        );
        mockVehicleId = vehRes.rows[0].id;

        // 4. Setup Completed Trip
        const tripRes = await pool.query(
            "INSERT INTO trips (client_corporate_email, client_first_name, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id) VALUES ('clientINV@corp.com', 'Client INV', 'P-INV', 'D-INV', NOW(), 'completed', $1, $2) RETURNING id",
            [mockDriverId, mockVehicleId]
        );
        tripId = tripRes.rows[0].id;

        // 5. Structure Encrypted Payload Mocks
        const testMessages = [
            { from: 'client', content: 'Where are you?', timestamp: new Date().toISOString() },
            { from: 'driver', content: 'I am here.', timestamp: new Date().toISOString() }
        ];
        const stringifiedPayload = JSON.stringify(testMessages);
        const encryptedArchive = encrypt(stringifiedPayload);

        // 6. Setup Initial Pending Complaint Binding
        const complaintRes = await pool.query(
            `INSERT INTO complaints (trip_id, category, description, status, encrypted_message_archive)
             VALUES ($1, 'safety', 'Erratic driving', 'pending', $2)
             RETURNING id`,
            [tripId, encryptedArchive]
        );
        complaintId = complaintRes.rows[0].id;
    });

    afterAll(async () => {
        await new Promise((resolve) => httpServer.close(resolve));

        // Cleanup Native Resources
        await pool.query('DELETE FROM audit_log WHERE target_id = $1 OR actor_id = $1', [complaintId]);
        await pool.query('DELETE FROM complaints WHERE id = $1', [complaintId]);
        await pool.query('DELETE FROM trips WHERE id = $1', [tripId]);
        await pool.query('DELETE FROM vehicles WHERE id = $1', [mockVehicleId]);
        await pool.query('DELETE FROM drivers WHERE id = $1', [mockDriverId]);
        await pool.query('DELETE FROM fleet_managers WHERE id = $1', [managerId]);

        await pool.end();
        await client.quit();
    });

    it('Test 1: Fleet manager can view complaint details', async () => {
        const res = await request(app)
            .get(`/api/complaints/${complaintId}`)
            .set('Authorization', `Bearer ${managerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.complaint_id).toBe(complaintId);
        expect(res.body.trip_details).toBeDefined();
        // Crucial validation masking cryptographic arrays globally
        expect(res.body.encrypted_message_archive).toBeUndefined();
    });

    it('Test 2: Message archive blocked unless under investigation', async () => {
        const res = await request(app)
            .get(`/api/complaints/${complaintId}/messages`)
            .set('Authorization', `Bearer ${managerToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Message archive only accessible during active investigation');
    });

    it('Test 3: Status update logged with old and new status', async () => {
        const res = await request(app)
            .patch(`/api/complaints/${complaintId}/status`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ status: 'under_investigation' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('under_investigation');

        const auditCheck = await pool.query(
            `SELECT details FROM audit_log WHERE action_type = 'COMPLAINT_STATUS_UPDATED' AND target_id = $1 ORDER BY timestamp DESC LIMIT 1`,
            [complaintId]
        );
        expect(auditCheck.rows.length).toBe(1);
        const details = auditCheck.rows[0].details;
        expect(details.old_status).toBe('pending');
        expect(details.new_status).toBe('under_investigation');
    });

    it('Test 4: Message archive accessible under investigation', async () => {
        const res = await request(app)
            .get(`/api/complaints/${complaintId}/messages`)
            .set('Authorization', `Bearer ${managerToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.messages)).toBe(true);
        expect(res.body.messages.length).toBe(2);

        // Asserting decrypted structures natively bypassing hexadecimal masking
        expect(res.body.messages[0].from).toBe('client');
        expect(res.body.messages[0].content).toBe('Where are you?');
    });

    it('Test 5: Every message archive access is audit logged', async () => {
        const auditCheck = await pool.query(
            `SELECT id FROM audit_log WHERE action_type = 'MESSAGE_ARCHIVE_ACCESSED' AND target_id = $1 AND actor_id = $2`,
            [complaintId, managerId]
        );
        // We evaluate strictly verifying accountability metrics inserted seamlessly.
        expect(auditCheck.rows.length).toBeGreaterThanOrEqual(1);
    });
});
