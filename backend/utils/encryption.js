import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// CONDITIONAL PERSISTENCE ENCRYPTION
// ─────────────────────────────────────────────────────────────────────────────
// The encryption key is derived dynamically from JWT_SECRET at runtime and 
// never stored anywhere — it exists strictly in memory during AES-256-GCM 
// operations. This guarantees that even if the PostgreSQL database is compromised, 
// the encrypted_message_archive cannot be decrypted natively without physical 
// access to the production server environment and secrets.
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const SALT = 'fleet-ops-salt';
const KEY_LENGTH = 32;

/**
 * Encrypts a plaintext string natively generating an Ephemeral IV and Auth Tag.
 * @param {string} plaintext - The raw string to safely encrypt.
 * @returns {string} Stringified JSON containing the hex { iv, tag, data }.
 */
export function encrypt(plaintext) {
    // Dynamically derive the 32-byte key at runtime.
    const key = crypto.scryptSync(process.env.JWT_SECRET, SALT, KEY_LENGTH);

    // Architect randomly bounds via 16-byte native IV limits
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
        iv: iv.toString('hex'),
        tag: authTag.toString('hex'),
        data: encrypted
    });
}

/**
 * Computes a SHA-256 proof-of-existence hash over all 4 Redis session keys for a
 * trip, capturing their values BEFORE deletion. The hash is stored in audit_log
 * and satisfies DPA 2019 s.41 (destruction verification without retaining content).
 *
 * @param {string} tripId
 * @param {import('ioredis').Redis | import('@redis/client').RedisClientType} redisClient
 * @returns {Promise<string>} 64-char lowercase hex SHA-256 digest
 */
export async function computeDestructionHash(tripId, redisClient) {
    const keys = [
        `session:trip:${tripId}:driver`,
        `session:trip:${tripId}:client`,
        `messages:trip:${tripId}`,
        `complaint:window:${tripId}`,
    ];
    const values = await redisClient.mGet(keys);
    const payload = keys.map((k, i) => `${k}=${values[i] ?? 'nil'}`).join('|');
    return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Decrypts a previously encrypted JSON architecture isolating parameters natively.
 * @param {string} encryptedJson - The JSON structure emitted by encrypt().
 * @returns {string} The decrypted standard plaintext string.
 */
export function decrypt(encryptedJson) {
    const { iv, tag, data } = JSON.parse(encryptedJson);

    // Derive exactly tracking identical parameters
    const key = crypto.scryptSync(process.env.JWT_SECRET, SALT, KEY_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
