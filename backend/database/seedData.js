// ─────────────────────────────────────────────────────────────────────────────
// Development Data Seed Script
// ─────────────────────────────────────────────────────────────────────────────
// FOR DEVELOPMENT AND TESTING ONLY.
// Never use this script to seed production databases.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

const EMAIL = 'manager@fleetops.dev';
const NAME = 'Test Manager';
const PASSWORD = 'FleetOps2026!';

try {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    await query(
        `INSERT INTO fleet_managers (full_name, work_email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (work_email) DO NOTHING`,
        [NAME, EMAIL, passwordHash]
    );

    console.log(`[seed] ${NAME} <${EMAIL}> inserted (or already exists).`);
    process.exit(0);
} catch (err) {
    console.error('[seed] Error seeding data:', err);
    process.exit(1);
}
