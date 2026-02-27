// ─────────────────────────────────────────────────────────────────────────────
// Auth Integration Tests — Ephemeral Credential Lifecycle
// ─────────────────────────────────────────────────────────────────────────────
// These three tests validate the full ephemeral credential lifecycle:
//   issue → invalidate → reject
// This is the core security guarantee of the Mediated Ephemeral Identity
// framework: credentials are time-bound, explicitly revocable, and once
// invalidated they cannot be reused — even within their original validity window.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { connect as connectDb } from '../config/db.js';
import { connect as connectRedis } from '../config/redis.js';
import redisClient from '../config/redis.js';
import pool from '../config/db.js';
import authRouter from '../routes/auth.js';
import { requireAuth } from '../middleware/auth.js';

// ── Minimal Express app shared across all tests ───────────────────────────
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// Throw-away protected route used only in test 3 — no production code altered
app.get('/api/test/protected', requireAuth, (_req, res) => {
    res.status(200).json({ message: 'reached protected route' });
});

// ── Lifecycle hooks ────────────────────────────────────────────────────────
beforeAll(async () => {
    await connectDb();
    await connectRedis();
});

afterAll(async () => {
    await redisClient.quit();
    await pool.end();
});

// ── Test suite ─────────────────────────────────────────────────────────────
describe('Auth routes', () => {
    // Test 1 — Login with valid credentials
    test('login with valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: process.env.TEST_MANAGER_EMAIL,
                password: process.env.TEST_MANAGER_PASSWORD,
            });

        expect(res.statusCode).toBe(200);
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(0);
    });

    // Test 2 — Login with invalid credentials
    test('login with invalid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: process.env.TEST_MANAGER_EMAIL,
                password: 'definitely_wrong_password',
            });

        expect(res.statusCode).toBe(401);
    });

    // Test 3 — Blocklist check: logged-out token must be rejected
    test('blocklist check — logged-out token is rejected', async () => {
        // Step 1: obtain a valid token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: process.env.TEST_MANAGER_EMAIL,
                password: process.env.TEST_MANAGER_PASSWORD,
            });

        const { token } = loginRes.body;

        // Step 2: log out — token is added to Redis blocklist
        await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${token}`);

        // Step 3: attempt to use the same token on a protected route
        const protectedRes = await request(app)
            .get('/api/test/protected')
            .set('Authorization', `Bearer ${token}`);

        expect(protectedRes.statusCode).toBe(401);
        expect(protectedRes.body.error).toBe('Session invalidated');
    });
});
