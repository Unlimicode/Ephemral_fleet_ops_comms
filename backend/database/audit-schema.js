// Audit the live DB schema against what the application code expects.
// Prints a column-by-column report so we can spot any unapplied migration.
import 'dotenv/config';
import db from '../config/db.js';

const expected = {
    fleet_managers: ['id','work_email','password_hash','full_name','created_at'],
    drivers: ['id','fleet_manager_id','full_name','work_email','password_hash','employee_id','active_status'],
    vehicles: ['id','registration_number','make','model','type','capacity'],
    trips: ['id','client_corporate_email','client_first_name','pickup_location','destination','pickup_time','status','assigned_driver_id','vehicle_id','flight_number','notes','additional_info','eta','created_at'],
    complaints: ['id','trip_id','category','description','status','encrypted_message_archive','investigation_notes','created_at'],
    audit_log: ['id','action_type','actor_id','actor_role','target_id','timestamp','ip_address','details','legal_basis','retention_category','destruction_hash','data_subjects'],
    push_subscriptions: ['id','driver_id','endpoint','p256dh','auth','created_at'],
    client_push_subscriptions: ['id','client_email','endpoint','p256dh','auth','created_at'],
    driver_notifications: ['id','driver_id','title','body','type','trip_id','read','created_at'],
    enquiries: ['id','name','company','email','message','status','created_at'],
    direct_messages: ['id','trip_id','sender_role','body','created_at','driver_id','client_email','read_by_manager_at','read_by_recipient_at'],
    driver_password_resets: ['token','driver_id','issued_by','expires_at','used_at','created_at'],
};

try {
    const tablesRes = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
    const actualTables = new Set(tablesRes.rows.map(r => r.table_name));

    let missingTables = 0;
    let missingCols = 0;

    for (const [table, cols] of Object.entries(expected)) {
        if (!actualTables.has(table)) {
            console.log(`\n✘ MISSING TABLE: ${table}`);
            missingTables++;
            continue;
        }
        const colRes = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [table]);
        const actualCols = new Set(colRes.rows.map(r => r.column_name));
        const missing = cols.filter(c => !actualCols.has(c));
        if (missing.length > 0) {
            console.log(`\n✘ ${table}: missing columns -> ${missing.join(', ')}`);
            missingCols += missing.length;
        } else {
            console.log(`✓ ${table}`);
        }
    }

    // Check trips.status CHECK constraint includes 'cancelled'
    const checkRes = await db.query(`
        SELECT pg_get_constraintdef(con.oid) AS def
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'trips' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%status%'
    `);
    console.log('\ntrips.status CHECK constraints:');
    checkRes.rows.forEach(r => console.log('  ' + r.def));

    console.log(`\nSummary: ${missingTables} missing tables, ${missingCols} missing columns`);
} finally {
    await db.end();
}
