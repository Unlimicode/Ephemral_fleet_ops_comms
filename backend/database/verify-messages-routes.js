// Smoke test: spin up the route stack in-process with a real JWT and hit every
// /api/messages endpoint to prove they return data against the live DB.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import redis from '../config/redis.js';
import messagesRouter from '../routes/messages.js';

await redis.connect();
const app = express();
app.use(express.json());
app.use('/api/messages', messagesRouter);

// Fetch the seeded fleet manager + a driver so we can sign a token
const fmRow = await db.query('SELECT id FROM fleet_managers LIMIT 1');
const drvRow = await db.query('SELECT id, work_email FROM drivers ORDER BY full_name LIMIT 1');
const fmId = fmRow.rows[0].id;
const driverId = drvRow.rows[0].id;
const driverEmail = drvRow.rows[0].work_email;

const managerToken = jwt.sign({ id: fmId, role: 'fleet_manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const driverToken  = jwt.sign({ id: driverId, role: 'driver' },    process.env.JWT_SECRET, { expiresIn: '1h' });

const hit = async (label, method, path, token, body) => {
    const req = request(app)[method.toLowerCase()](path).set('Authorization', `Bearer ${token}`);
    const res = body ? await req.send(body) : await req;
    const sample = Array.isArray(res.body) ? `${res.body.length} rows`
        : (res.body?.messages ? `${res.body.messages.length} msgs` : JSON.stringify(res.body).slice(0, 80));
    console.log(`  ${res.status === 200 || res.status === 201 ? '✓' : '✘'} ${label.padEnd(40)} ${res.status}  ${sample}`);
    if (res.status >= 400) console.log('    body:', JSON.stringify(res.body));
    return res;
};

console.log('\n=== Manager endpoints ===');
await hit('GET /threads/drivers',              'GET',  '/api/messages/threads/drivers', managerToken);
await hit('GET /threads/clients',              'GET',  '/api/messages/threads/clients', managerToken);
await hit(`GET /threads/driver/:id`,           'GET',  `/api/messages/threads/driver/${driverId}`, managerToken);
const clientEmail = 'sarah.mitchell@techcorp.com';
await hit(`GET /threads/client/:email`,        'GET',  `/api/messages/threads/client/${encodeURIComponent(clientEmail)}`, managerToken);
await hit(`POST /threads/driver/:id`,          'POST', `/api/messages/threads/driver/${driverId}`, managerToken, { body: 'TEST manager->driver ' + Date.now() });
await hit(`POST /threads/client/:email`,       'POST', `/api/messages/threads/client/${encodeURIComponent(clientEmail)}`, managerToken, { body: 'TEST manager->client ' + Date.now() });

console.log('\n=== Driver endpoints ===');
await hit('GET /driver/mine',                  'GET',  '/api/messages/driver/mine', driverToken);
await hit('POST /driver/mine',                 'POST', '/api/messages/driver/mine', driverToken, { body: 'TEST driver->manager ' + Date.now() });

console.log(`\nUsed manager FM ${fmId.slice(0,8)}, driver ${driverEmail}`);

await redis.quit();
await db.end();
