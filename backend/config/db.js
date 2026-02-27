import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Run a one-off query against the pool */
export const query = (text, params) => pool.query(text, params);

/** Test the connection on startup */
export async function connect() {
    const client = await pool.connect();
    console.log('[db] PostgreSQL connected');
    client.release();
}

export default pool;
