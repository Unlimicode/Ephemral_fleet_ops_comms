// Full end-to-end smoke test of every endpoint that gets touched during the demo.
// Mounts the real route stack against the real DB and exercises each critical
// user flow with role-correct JWTs and cookies.
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../config/db.js';
import redis from '../config/redis.js';
import { setSession } from '../config/redisHelpers.js';
import { initIo } from '../socket/io.js';
import routerIndex from '../routes/index.js';

await redis.connect();

const app = express();
app.use(cookieParser());
app.use(express.json());
const httpServer = createServer(app);
initIo(httpServer);
app.use(routerIndex);

let pass = 0;
let fail = 0;
const failures = [];

const hit = async (label, method, path, opts = {}) => {
    const r = request(app)[method.toLowerCase()](path);
    if (opts.token) r.set('Authorization', `Bearer ${opts.token}`);
    if (opts.cookie) r.set('Cookie', opts.cookie);
    if (opts.body) r.send(opts.body);
    let res;
    try {
        res = await r;
    } catch (err) {
        fail++;
        failures.push(`${label}: ${err.message}`);
        console.log(`  ✘ ${label.padEnd(50)} threw  ${err.message}`);
        return null;
    }
    const expected = opts.expected || [200, 201];
    const ok = expected.includes(res.status);
    if (ok) pass++;
    else { fail++; failures.push(`${label}: got ${res.status} expected ${expected.join('|')} — ${JSON.stringify(res.body).slice(0, 200)}`); }
    const sample = Array.isArray(res.body) ? `${res.body.length} rows`
        : res.body?.messages ? `${res.body.messages.length} msgs`
        : res.body?.trips ? `${res.body.trips.length} trips`
        : res.body?.entries ? `${res.body.entries.length} entries`
        : res.body?.notifications ? `${res.body.notifications.length} notifs`
        : JSON.stringify(res.body || {}).slice(0, 80);
    console.log(`  ${ok ? '✓' : '✘'} ${label.padEnd(50)} ${res.status}  ${sample}`);
    return res;
};

// ───────────────────────────────────────────────────────────────────────────
// Setup: get seeded ids and tokens
// ───────────────────────────────────────────────────────────────────────────
const fm     = (await db.query('SELECT id FROM fleet_managers LIMIT 1')).rows[0];
const driverAvailable = (await db.query("SELECT id, work_email FROM drivers WHERE full_name='James Kariuki' LIMIT 1")).rows[0];
const driverOnTrip    = (await db.query("SELECT id FROM drivers WHERE full_name='Peter Njoroge' LIMIT 1")).rows[0];
const vehicle  = (await db.query("SELECT id FROM vehicles WHERE registration_number='KDA 001A' LIMIT 1")).rows[0];
const trip = (await db.query("SELECT id FROM trips WHERE status='pending' LIMIT 1")).rows[0];
const inProgressTrip = (await db.query("SELECT id, client_corporate_email FROM trips WHERE status='in_progress' LIMIT 1")).rows[0];
const openComplaint  = (await db.query("SELECT id, trip_id FROM complaints WHERE status='open' LIMIT 1")).rows[0];
const underInvComplaint  = (await db.query("SELECT id, trip_id FROM complaints WHERE status='under_investigation' LIMIT 1")).rows[0];
const completedTrip = (await db.query("SELECT id, client_corporate_email FROM trips WHERE status='completed' LIMIT 1")).rows[0];

const managerToken = jwt.sign({ id: fm.id, role: 'fleet_manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const driverToken  = jwt.sign({ id: driverAvailable.id, role: 'driver' }, process.env.JWT_SECRET, { expiresIn: '1h' });

// Build a client cookie keyed to the in-progress trip
const clientJwt = jwt.sign(
    { client_corporate_email: inProgressTrip.client_corporate_email, trip_id: inProgressTrip.id, role: 'client', session_type: 'full' },
    process.env.JWT_SECRET, { expiresIn: '1h' }
);
const clientCookie = `client_session=${clientJwt}`;

// Build a client cookie for a completed-trip client (for complaint flow)
const compClientJwt = jwt.sign(
    { client_corporate_email: completedTrip.client_corporate_email, trip_id: completedTrip.id, role: 'client', session_type: 'full' },
    process.env.JWT_SECRET, { expiresIn: '1h' }
);
const compClientCookie = `client_session=${compClientJwt}`;

console.log(`\nUsing fm=${fm.id.slice(0,8)} driver=${driverAvailable.work_email} trip=${trip.id.slice(0,8)} inProg=${inProgressTrip.id.slice(0,8)}`);

// ───────────────────────────────────────────────────────────────────────────
// Manager flows
// ───────────────────────────────────────────────────────────────────────────
console.log('\n━━━━ Manager dispatch ━━━━');
await hit('GET  /api/trips',                              'GET',  '/api/trips',          { token: managerToken });
await hit('GET  /api/roster/drivers',                     'GET',  '/api/roster/drivers', { token: managerToken });
await hit('GET  /api/vehicles',                           'GET',  '/api/vehicles',       { token: managerToken });
await hit('GET  /api/drivers/availability',               'GET',  '/api/drivers/availability', { token: managerToken });

console.log('\n━━━━ Manager — Complaints ━━━━');
await hit('GET  /api/complaints',                         'GET',  '/api/complaints',     { token: managerToken });
await hit('GET  /api/complaints/:id (under_investigation)','GET', `/api/complaints/${underInvComplaint.id}`, { token: managerToken });
await hit('GET  /api/complaints/:id/messages (decrypted)', 'GET', `/api/complaints/${underInvComplaint.id}/messages`, { token: managerToken });

console.log('\n━━━━ Manager — Dashboard & Audit ━━━━');
await hit('GET  /api/dashboard/overview',                 'GET',  '/api/dashboard/overview',         { token: managerToken });
await hit('GET  /api/dashboard/summary',                  'GET',  '/api/dashboard/summary',          { token: managerToken });
await hit('GET  /api/dashboard/sessions',                 'GET',  '/api/dashboard/sessions',         { token: managerToken });
await hit('GET  /api/dashboard/registry',                 'GET',  '/api/dashboard/registry',         { token: managerToken });
await hit('GET  /api/dashboard/destruction-events',       'GET',  '/api/dashboard/destruction-events', { token: managerToken });
await hit('GET  /api/dashboard/compliance-report',        'GET',  '/api/dashboard/compliance-report', { token: managerToken });
await hit('GET  /api/dashboard/audit',                    'GET',  '/api/dashboard/audit?limit=20',   { token: managerToken });
await hit('GET  /api/roster/audit',                       'GET',  '/api/roster/audit?limit=20',      { token: managerToken });
await hit('GET  /api/contact (enquiries)',                'GET',  '/api/contact',                    { token: managerToken });

console.log('\n━━━━ Manager — Messages ━━━━');
await hit('GET  /api/messages/threads/drivers',           'GET',  '/api/messages/threads/drivers', { token: managerToken });
await hit('GET  /api/messages/threads/clients',           'GET',  '/api/messages/threads/clients', { token: managerToken });
await hit('GET  /api/messages/threads/driver/:id',        'GET', `/api/messages/threads/driver/${driverAvailable.id}`, { token: managerToken });
await hit('GET  /api/messages/threads/client/:email',     'GET', `/api/messages/threads/client/${encodeURIComponent('sarah.mitchell@techcorp.com')}`, { token: managerToken });

console.log('\n━━━━ Manager — Driver/Vehicle ops ━━━━');
await hit('POST /api/roster/drivers/:id/reset-password',  'POST', `/api/roster/drivers/${driverAvailable.id}/reset-password`, { token: managerToken });

// Verify reset token was created
const resetTokenRow = await db.query('SELECT token FROM driver_password_resets WHERE driver_id=$1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1', [driverAvailable.id]);
const resetToken = resetTokenRow.rows[0]?.token;
console.log(`  → reset token persisted: ${resetToken ? '✓ ' + resetToken.slice(0,12) + '…' : '✘ MISSING'}`);

console.log('\n━━━━ Driver password reset flow ━━━━');
if (resetToken) {
    await hit('GET  /api/drivers/auth/reset/:token',      'GET',  `/api/drivers/auth/reset/${resetToken}`);
    // Don't actually submit a new password (would lock the driver out for the demo).
    // Instead test validation: bad token
    await hit('POST /api/drivers/auth/reset/:bad (404)',  'POST', `/api/drivers/auth/reset/${'x'.repeat(64)}`, { body: { password: 'newPassword123' }, expected: [404] });
    await hit('POST /api/drivers/auth/reset/:token short','POST', `/api/drivers/auth/reset/${resetToken}`, { body: { password: 'short' }, expected: [400] });
}

console.log('\n━━━━ Driver flows ━━━━');
await hit('GET  /api/drivers/me',                         'GET',  '/api/drivers/me',                { token: driverToken });
await hit('GET  /api/drivers/notifications',              'GET',  '/api/drivers/notifications',     { token: driverToken });
await hit('GET  /api/driver/trips',                       'GET',  '/api/driver/trips',              { token: driverToken });
await hit('GET  /api/push/vapid-key',                     'GET',  '/api/push/vapid-key',            { token: driverToken });
await hit('GET  /api/messages/driver/mine',               'GET',  '/api/messages/driver/mine',      { token: driverToken });

console.log('\n━━━━ Client flows ━━━━');
await hit('GET  /api/bookings/me',                        'GET',  '/api/bookings/me',               { cookie: clientCookie });
await hit('GET  /api/bookings/history',                   'GET',  '/api/bookings/history',          { cookie: clientCookie });
await hit('GET  /api/bookings/:tripId',                   'GET', `/api/bookings/${inProgressTrip.id}`, { cookie: clientCookie });
await hit('GET  /api/bookings/flight-info',               'GET',  '/api/bookings/flight-info',      { cookie: clientCookie });
await hit('GET  /api/messages/client/mine',               'GET',  '/api/messages/client/mine',      { cookie: clientCookie });

console.log('\n━━━━ Flight API ━━━━');
await hit('GET  /api/flights/info?iata=KQ101',            'GET',  '/api/flights/info?iata=KQ101&date=2026-05-15', { token: managerToken, expected: [200, 502] });

console.log('\n━━━━ Investigation note → driver notification ━━━━');
// Add notes to a complaint — this should create a driver_notifications row
const beforeCount = (await db.query("SELECT COUNT(*) FROM driver_notifications WHERE type='investigation_note'")).rows[0].count;
await hit('PATCH /api/complaints/:id/notes',              'PATCH', `/api/complaints/${underInvComplaint.id}/notes`, { token: managerToken, body: { notes: 'AUDIT TEST: investigation note ' + Date.now() } });
const afterCount = (await db.query("SELECT COUNT(*) FROM driver_notifications WHERE type='investigation_note'")).rows[0].count;
console.log(`  → investigation_note notifications: ${beforeCount} → ${afterCount} ${Number(afterCount) > Number(beforeCount) ? '✓' : '✘ DID NOT CREATE'}`);

// ───────────────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}\n  SUMMARY: ${pass} passed, ${fail} failed\n`);
if (fail > 0) {
    console.log('FAILURES:');
    failures.forEach(f => console.log('  • ' + f));
    process.exit(1);
}

await redis.quit();
await db.end();
