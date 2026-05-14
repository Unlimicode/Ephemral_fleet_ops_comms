// ─────────────────────────────────────────────────────────────────────────────
// Redis Client — Single shared connection used everywhere in the backend.
//
// Redis is the ephemeral-state layer of the MEI (Mediated Ephemeral Identity)
// framework. EVERY key written through redisHelpers.js carries a mandatory TTL,
// so anything stored here is guaranteed to self-destruct on a deadline. That is
// how SwiftLink enforces privacy as a structural property of the system —
// session keys, magic link tokens, complaint windows, and message buffers all
// expire on their own without any cleanup code.
//
// This file just configures the connection. The actual semantic patterns
// (setSession, getSession, deleteSession, extendSession, getTTL) live in
// config/redisHelpers.js — see that file for the key naming conventions.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL });

client.on('error', (err) => console.error('[redis] client error:', err));
client.on('connect', () => console.log('[redis] Redis connected'));

/** Connect to Redis — call once at startup */
export async function connect() {
    await client.connect();
}

export default client;
