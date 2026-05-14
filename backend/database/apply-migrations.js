import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

const targets = process.argv.slice(2);
if (targets.length === 0) {
    console.error('Usage: node database/apply-migrations.js <migration_filename> [<migration_filename>...]');
    process.exit(1);
}

for (const target of targets) {
    const full = path.join(migrationsDir, target);
    if (!fs.existsSync(full)) {
        console.error(`✘ Not found: ${full}`);
        process.exit(1);
    }
    const sql = fs.readFileSync(full, 'utf8');
    console.log(`→ Applying ${target}...`);
    try {
        await db.query(sql);
        console.log(`  ✓ Applied ${target}`);
    } catch (err) {
        console.error(`  ✘ Failed ${target}: ${err.message}`);
        await db.end();
        process.exit(1);
    }
}

await db.end();
console.log('All migrations applied successfully.');
