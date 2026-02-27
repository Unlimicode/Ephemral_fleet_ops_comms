import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL });

client.on('error', (err) => console.error('[redis] client error:', err));
client.on('connect', () => console.log('[redis] Redis connected'));

/** Connect to Redis — call once at startup */
export async function connect() {
    await client.connect();
}

export default client;
