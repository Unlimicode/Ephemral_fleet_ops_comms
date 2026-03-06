import 'dotenv/config';
import db from '../config/db.js';
import bcrypt from 'bcryptjs';

async function runSeed() {
    console.log('🌱 Starting database seed process...');

    try {
        // 1. Delete existing data in proper dependency order
        console.log('Clearing existing data...');
        await db.query('DELETE FROM push_subscriptions');
        await db.query('DELETE FROM complaints');
        await db.query('DELETE FROM trips'); // Handles messages via CASCADE if schema changes, but schema requires trips before drivers/vehicles
        await db.query('DELETE FROM vehicles');
        await db.query('DELETE FROM drivers');
        await db.query('DELETE FROM fleet_managers');

        // 2. Hash passwords
        const managerPassword = await bcrypt.hash('FleetOps2026!', 10);
        const driverPassword = await bcrypt.hash('Driver2026!', 10);

        // 3. Insert Fleet Manager
        console.log('Seeding Fleet Manager...');
        const fmRes = await db.query(
            `INSERT INTO fleet_managers (full_name, work_email, password_hash)
             VALUES ($1, $2, $3) RETURNING id`,
            ['Fleet Manager', 'manager@fleetops.dev', managerPassword]
        );
        const fmId = fmRes.rows[0].id;

        // 4. Insert Drivers
        console.log('Seeding Drivers...');
        const drivers = [
            { name: 'James Kariuki', email: 'james@fleetops.dev', emp_id: 'DRV001' },
            { name: 'Amina Osei', email: 'amina@fleetops.dev', emp_id: 'DRV002' },
            { name: 'Peter Njoroge', email: 'peter@fleetops.dev', emp_id: 'DRV003' }
        ];

        const driverIds = [];
        for (const driver of drivers) {
            const res = await db.query(
                `INSERT INTO drivers (fleet_manager_id, full_name, work_email, password_hash, employee_id)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [fmId, driver.name, driver.email, driverPassword, driver.emp_id]
            );
            driverIds.push(res.rows[0].id);
        }

        // 5. Insert Vehicles
        console.log('Seeding Vehicles...');
        const vehicles = [
            { reg: 'KDA 001A', type: 'Sedan', capacity: 4 },
            { reg: 'KDB 002B', type: 'SUV', capacity: 7 },
            { reg: 'KDC 003C', type: 'Van', capacity: 12 }
        ];

        for (const vehicle of vehicles) {
            await db.query(
                `INSERT INTO vehicles (registration_number, type, capacity)
                 VALUES ($1, $2, $3)`,
                [vehicle.reg, vehicle.type, vehicle.capacity]
            );
        }

        // 6. Insert Bookings (Pending Trips)
        console.log('Seeding Bookings...');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const booking1Date = new Date(tomorrow);
        booking1Date.setHours(9, 0, 0, 0);

        const booking2Date = new Date(tomorrow);
        booking2Date.setHours(14, 30, 0, 0);

        await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, flight_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ['Sarah', 'sarah.mitchell@techcorp.com', 'JKIA Terminal 1A', 'Radisson Blu Hotel Nairobi', booking1Date, 'pending', 'KQ101']
        );

        await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            ['David', 'david.okafor@unnairobi.org', 'UN Gigiri Complex', 'JKIA Terminal 1A', booking2Date, 'pending']
        );

        // 7. Print Summary
        console.log('\n✅ Seed complete');
        console.log('   Fleet Manager : manager@fleetops.dev / FleetOps2026!');
        console.log('   Drivers       : james@fleetops.dev / Driver2026!');
        console.log('                   amina@fleetops.dev / Driver2026!');
        console.log('                   peter@fleetops.dev / Driver2026!');
        console.log('   Vehicles      : KDA 001A, KDB 002B, KDC 003C');
        console.log('   Bookings      : 2 pending bookings created\n');

    } catch (error) {
        console.error('❌ Failed to seed database:', error);
    } finally {
        // Close DB pool to allow script to exit
        db.end();
    }
}

runSeed();
