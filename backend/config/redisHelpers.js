// ─────────────────────────────────────────────────────────────────────────────
// Redis TTL Helper Layer — Privacy-Preserving Fleet Operations System
// ─────────────────────────────────────────────────────────────────────────────
// These helpers enforce TTL as a mandatory parameter — no session data can be
// stored without an expiration. This is an architectural guarantee of the
// Mediated Ephemeral Identity framework.
// ─────────────────────────────────────────────────────────────────────────────

import client from './redis.js';

/**
 * Serialize `value` to JSON and store it under `key` with a mandatory TTL.
 * @param {string} key
 * @param {*} value  — any JSON-serializable value
 * @param {number} ttlSeconds  — expiration in seconds (required, no default)
 */
export async function setSession(key, value, ttlSeconds) {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

/**
 * Retrieve and parse the JSON value stored at `key`.
 * Returns null if the key does not exist or has expired.
 * @param {string} key
 * @returns {Promise<*|null>}
 */
export async function getSession(key) {
    const raw = await client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw);
}

/**
 * Explicitly delete a key (e.g. on logout or session invalidation).
 * @param {string} key
 */
export async function deleteSession(key) {
    await client.del(key);
}

/**
 * Reset the TTL on an existing key without changing its value.
 * Used for sliding-window session renewal.
 * @param {string} key
 * @param {number} ttlSeconds  — new expiration in seconds (required)
 */
export async function extendSession(key, ttlSeconds) {
    await client.expire(key, ttlSeconds);
}

/**
 * getTTL(key)
 * - Returns -2 if the key does not exist.
 * - Returns -1 if the key exists but has no expiry.
 * - Returns positive integer (TTL in seconds) otherwise.
 * The dashboard uses this to drive countdown timers on the frontend.
 */
export async function getTTL(key) {
    const ttl = await client.ttl(key);
    return ttl;
}
