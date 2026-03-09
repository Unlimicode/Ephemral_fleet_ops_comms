import 'dotenv/config';
import db from '../config/db.js';
import redisClient from '../config/redis.js';
import bcrypt from 'bcryptjs';
import { encrypt } from '../utils/encryption.js';

async function runSeed() {
    console.log('🌱 Starting database seed process...');

    try {
        // Connect to Redis
        await redisClient.connect();
        console.log('[redis] Connected for seeding');

        // 1. Delete existing data in proper dependency order
        console.log('Clearing existing data (Postgres & Redis)...');
        await redisClient.flushAll();
        await db.query('DELETE FROM push_subscriptions');
        await db.query('DELETE FROM complaints');
        await db.query('DELETE FROM trips');
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
        const driversData = [
            { name: 'James Kariuki', email: 'james@fleetops.dev', emp_id: 'DRV001' },
            { name: 'Amina Osei', email: 'amina@fleetops.dev', emp_id: 'DRV002' },
            { name: 'Peter Njoroge', email: 'peter@fleetops.dev', emp_id: 'DRV003' }
        ];

        const driverIds = {};
        for (const d of driversData) {
            const res = await db.query(
                `INSERT INTO drivers (fleet_manager_id, full_name, work_email, password_hash, employee_id)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [fmId, d.name, d.email, driverPassword, d.emp_id]
            );
            driverIds[d.name] = res.rows[0].id;
        }

        // 5. Insert Vehicles
        console.log('Seeding Vehicles...');
        const vehiclesData = [
            { reg: 'KDA 001A', type: 'Sedan', capacity: 4 },
            { reg: 'KDB 002B', type: 'SUV', capacity: 7 },
            { reg: 'KDC 003C', type: 'Van', capacity: 12 }
        ];

        const vehicleIds = {};
        for (const v of vehiclesData) {
            const res = await db.query(
                `INSERT INTO vehicles (registration_number, type, capacity)
                 VALUES ($1, $2, $3) RETURNING id`,
                [v.reg, v.type, v.capacity]
            );
            vehicleIds[v.reg] = res.rows[0].id;
        }

        // 6. Insert Bookings & Trips
        console.log('Seeding Bookings & Trips...');
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(now.getDate() - 2);

        // Sarah Mitchell - Assigned
        const sarahTripDate = new Date(tomorrow);
        sarahTripDate.setHours(9, 0, 0, 0);
        await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, flight_number, assigned_driver_id, vehicle_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            ['Sarah', 'sarah.mitchell@techcorp.com', 'JKIA Terminal 1A', 'Radisson Blu Hotel Nairobi', sarahTripDate, 'accepted', 'KQ101', driverIds['James Kariuki'], vehicleIds['KDA 001A']]
        );

        // David Okafor - Assigned
        const davidTripDate = new Date(tomorrow);
        davidTripDate.setHours(14, 30, 0, 0);
        await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            ['David', 'david.okafor@unnairobi.org', 'UN Gigiri Complex', 'JKIA Terminal 1A', davidTripDate, 'accepted', driverIds['Amina Osei'], vehicleIds['KDB 002B']]
        );

        // Elena Vasquez - In Progress
        const elenaTripRes = await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            ['Elena', 'elena.vasquez@globalconf.com', 'Hilton Nairobi', 'JKIA Terminal 1A', now, 'in_progress', driverIds['Peter Njoroge'], vehicleIds['KDC 003C']]
        );
        const elenaTripId = elenaTripRes.rows[0].id;
        await redisClient.set(`session:trip:${elenaTripId}:client`, JSON.stringify({ tripId: elenaTripId, clientName: 'Elena', status: 'active' }), { EX: 7200 });
        await redisClient.set(`session:trip:${elenaTripId}:driver`, JSON.stringify({ tripId: elenaTripId, driverId: driverIds['Peter Njoroge'], status: 'active' }), { EX: 7200 });

        // Marcus Webb - Completed (No Complaint)
        const marcusPickup = new Date(yesterday);
        marcusPickup.setHours(14, 0, 0, 0);
        const marcusComplete = new Date(yesterday);
        marcusComplete.setHours(15, 30, 0, 0);
        await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            ['Marcus', 'marcus.webb@techsummit.io', 'JKIA Terminal 2', 'Nairobi Serena Hotel', marcusPickup, 'completed', driverIds['James Kariuki'], vehicleIds['KDA 001A']]
        );

        // Priya Sharma - Completed (Filed Complaint)
        const priyaPickup = new Date(twoDaysAgo);
        priyaPickup.setHours(9, 0, 0, 0);
        const priyaComplete = new Date(twoDaysAgo);
        priyaComplete.setHours(10, 15, 0, 0);
        const priyaTripRes = await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            ['Priya', 'priya.sharma@unhabitat.org', 'UN Gigiri Complex', 'Radisson Blu Nairobi', priyaPickup, 'completed', driverIds['Amina Osei'], vehicleIds['KDB 002B']]
        );
        const priyaTripId = priyaTripRes.rows[0].id;

        const priyaMessages = [
            { from: 'client', content: 'Hi, I have been waiting for 15 minutes. Where are you?', timestamp: new Date(priyaPickup).toISOString() },
            { from: 'driver', content: 'Apologies, I am stuck in traffic on Waiyaki Way. ETA 10 minutes.', timestamp: new Date(priyaPickup.getTime() + 60000).toISOString() },
            { from: 'client', content: 'This is unacceptable. I have a conference starting in 20 minutes.', timestamp: new Date(priyaPickup.getTime() + 120000).toISOString() },
            { from: 'driver', content: 'I understand. I am now 5 minutes away.', timestamp: new Date(priyaPickup.getTime() + 180000).toISOString() },
            { from: 'client', content: 'Please hurry.', timestamp: new Date(priyaPickup.getTime() + 240000).toISOString() },
            { from: 'driver', content: 'I am outside now. Blue Toyota Prado KDB 002B.', timestamp: new Date(priyaPickup.getTime() + 300000).toISOString() }
        ];

        await db.query(
            `INSERT INTO complaints (trip_id, category, description, status, encrypted_message_archive)
             VALUES ($1, $2, $3, $4, $5)`,
            [priyaTripId, 'service_quality', 'Driver arrived 20 minutes late without notification. The delay caused me to miss the opening session of the conference.', 'under_investigation', encrypt(JSON.stringify(priyaMessages))]
        );

        // James Omondi - Complaint Window
        const jamesPickup = new Date(now);
        jamesPickup.setHours(6, 0, 0, 0);
        const jamesComplete = new Date(now);
        jamesComplete.setHours(7, 30, 0, 0);
        const jamesTripRes = await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            ['James', 'j.omondi@africacdc.org', 'JKIA Terminal 1A', 'Safari Park Hotel', jamesPickup, 'completed', driverIds['Peter Njoroge'], vehicleIds['KDC 003C']]
        );
        const jamesTripId = jamesTripRes.rows[0].id;
        // Key format per complaints.js router.post('/:tripId'): complaint:window:{tripId}
        await redisClient.set(`complaint:window:${jamesTripId}`, JSON.stringify({ tripId: jamesTripId, expiresAt: new Date(now.getTime() + 86400000).toISOString() }), { EX: 86400 });

        // 7. Print Summary
        console.log('\n✅ Seed complete');
        console.log('   Fleet Manager  : manager@fleetops.dev / FleetOps2026!');
        console.log('   Drivers        : james@fleetops.dev / Driver2026!');
        console.log('                    amina@fleetops.dev / Driver2026!');
        console.log('                    peter@fleetops.dev / Driver2026!');
        console.log('   Vehicles       : KDA 001A, KDB 002B, KDC 003C');
        console.log('   Bookings       : 2 pending, 2 assigned, 1 in-progress, 2 completed');
        console.log('   Complaints     : 1 filed (under investigation) with 6 preserved messages');
        console.log('   Redis sessions : 1 active in-progress trip session, 1 complaint window\n');

    } catch (error) {
        console.error('❌ Failed to seed database:', error);
    } finally {
        await redisClient.quit();
        await db.end();
    }
}

runSeed();
