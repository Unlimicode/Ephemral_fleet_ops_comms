import 'dotenv/config';
import db from '../config/db.js';
import redisClient from '../config/redis.js';
import bcrypt from 'bcryptjs';
import { encrypt } from '../utils/encryption.js';

async function runSeed() {
    console.log('🌱 Starting database seed process...');

    try {
        await redisClient.connect();
        console.log('[redis] Connected for seeding');

        // 1. Clear existing data
        console.log('Clearing existing data (Postgres & Redis)...');
        await redisClient.flushAll();
        await db.query(`DO $$ BEGIN DELETE FROM client_push_subscriptions; EXCEPTION WHEN undefined_table THEN NULL; END $$`);
        await db.query('DELETE FROM push_subscriptions');
        await db.query('DELETE FROM complaints');
        await db.query('DELETE FROM trips');
        await db.query('DELETE FROM vehicles');
        await db.query('DELETE FROM drivers');
        await db.query('DELETE FROM fleet_managers');

        // 2. Hash passwords
        const managerPassword = await bcrypt.hash('FleetOps2026!', 10);
        const driverPassword = await bcrypt.hash('Driver2026!', 10);

        // 3. Fleet Manager
        console.log('Seeding Fleet Manager...');
        const fmRes = await db.query(
            `INSERT INTO fleet_managers (full_name, work_email, password_hash)
             VALUES ($1, $2, $3) RETURNING id`,
            ['Fleet Manager', 'manager@fleetops.dev', managerPassword]
        );
        const fmId = fmRes.rows[0].id;

        // 4. Drivers — 5 total for a realistic roster view
        console.log('Seeding Drivers...');
        const driversData = [
            { name: 'James Kariuki',  email: 'james@fleetops.dev',  emp_id: 'DRV001', status: 'available' },
            { name: 'Amina Osei',     email: 'amina@fleetops.dev',  emp_id: 'DRV002', status: 'available' },
            { name: 'Peter Njoroge',  email: 'peter@fleetops.dev',  emp_id: 'DRV003', status: 'on_trip'   },
            { name: 'Faith Wambui',   email: 'faith@fleetops.dev',  emp_id: 'DRV004', status: 'on_trip'   },
            { name: 'Kevin Mwangi',   email: 'kevin@fleetops.dev',  emp_id: 'DRV005', status: 'on_trip'   },
        ];

        const driverIds = {};
        for (const d of driversData) {
            const res = await db.query(
                `INSERT INTO drivers (fleet_manager_id, full_name, work_email, password_hash, employee_id)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [fmId, d.name, d.email, driverPassword, d.emp_id]
            );
            driverIds[d.name] = res.rows[0].id;
            // Availability is Redis-backed — set it explicitly for the dispatch driver panel
            await redisClient.set(`driver:availability:${res.rows[0].id}`, JSON.stringify({ status: d.status, updated_at: new Date().toISOString() }), { EX: 86400 });
        }

        // 5. Vehicles — 5 total, with make/model for driver card display
        console.log('Seeding Vehicles...');
        const vehiclesData = [
            { reg: 'KDA 001A', make: 'Toyota',    model: 'Fielder',    type: 'Sedan', capacity: 4 },
            { reg: 'KDB 002B', make: 'Land Rover', model: 'Discovery', type: 'SUV',   capacity: 7 },
            { reg: 'KDC 003C', make: 'Toyota',    model: 'HiAce',      type: 'Van',   capacity: 12 },
            { reg: 'KDD 004D', make: 'Toyota',    model: 'Prado',      type: 'SUV',   capacity: 7 },
            { reg: 'KDE 005E', make: 'Toyota',    model: 'Corolla',    type: 'Sedan', capacity: 4 },
        ];

        const vehicleIds = {};
        for (const v of vehiclesData) {
            const res = await db.query(
                `INSERT INTO vehicles (registration_number, make, model, type, capacity)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [v.reg, v.make, v.model, v.type, v.capacity]
            );
            vehicleIds[v.reg] = res.rows[0].id;
        }

        // 6. Trips
        console.log('Seeding Trips...');
        const now = new Date();
        const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        const twoDaysAgo = new Date(now); twoDaysAgo.setDate(now.getDate() - 2);
        const threeDaysAgo = new Date(now); threeDaysAgo.setDate(now.getDate() - 3);

        // ── Pending (unassigned) — shows in "Incoming Bookings" panel ──────────
        const nadiaPickup = new Date(tomorrow); nadiaPickup.setHours(10, 0, 0, 0);
        await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, flight_number, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            ['Nadia', 'nadia.hassan@unep.org', 'JKIA Terminal 1A', 'UNEP Gigiri Complex', nadiaPickup, 'pending', 'ET304', 'VIP delegation — please display name card on arrival']
        );

        const tomPickup = new Date(tomorrow); tomPickup.setHours(16, 0, 0, 0);
        await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            ['Tom', 'tom.fletcher@weforum.org', 'Hilton Nairobi', 'Village Market, Gigiri', tomPickup, 'pending']
        );

        // ── Accepted (assigned, driver not started) ────────────────────────────
        const sarahPickup = new Date(tomorrow); sarahPickup.setHours(9, 0, 0, 0);
        const sarahEta = new Date(sarahPickup); sarahEta.setMinutes(sarahPickup.getMinutes() - 15);
        await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, flight_number, assigned_driver_id, vehicle_id, eta)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            ['Sarah', 'sarah.mitchell@techcorp.com', 'JKIA Terminal 1A', 'Radisson Blu Hotel, Nairobi', sarahPickup, 'accepted', 'KQ101', driverIds['James Kariuki'], vehicleIds['KDA 001A'], sarahEta]
        );

        const davidPickup = new Date(tomorrow); davidPickup.setHours(14, 30, 0, 0);
        const davidEta = new Date(davidPickup); davidEta.setMinutes(davidPickup.getMinutes() - 15);
        await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id, eta)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            ['David', 'david.okafor@unnairobi.org', 'UN Gigiri Complex', 'JKIA Terminal 1A', davidPickup, 'accepted', driverIds['Amina Osei'], vehicleIds['KDB 002B'], davidEta]
        );

        // ── In Progress — 3 trips for Privacy Dashboard TTL variety ───────────
        const elenaTripRes = await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            ['Elena', 'elena.vasquez@globalconf.com', 'Hilton Nairobi', 'JKIA Terminal 1A', now, 'in_progress', driverIds['Peter Njoroge'], vehicleIds['KDC 003C']]
        );
        const elenaTripId = elenaTripRes.rows[0].id;
        // Session with ~2h remaining — full green TTL bar
        await redisClient.set(`session:trip:${elenaTripId}:client`, JSON.stringify({ tripId: elenaTripId, clientName: 'Elena', status: 'active' }), { EX: 7200 });
        await redisClient.set(`session:trip:${elenaTripId}:driver`, JSON.stringify({ tripId: elenaTripId, driverId: driverIds['Peter Njoroge'], status: 'active' }), { EX: 7200 });
        // Chat history for driver active trip screenshot
        const elenaMessages = [
            { from: 'driver', content: 'Good morning, I am Peter your assigned driver. I am 5 minutes away from the pickup point.', timestamp: new Date(now.getTime() - 480000).toISOString() },
            { from: 'client', content: 'Perfect, I am in the hotel lobby. How will I recognise you?', timestamp: new Date(now.getTime() - 420000).toISOString() },
            { from: 'driver', content: 'I will be in a white Toyota HiAce, registration KDC 003C. I will be at the main entrance.', timestamp: new Date(now.getTime() - 360000).toISOString() },
            { from: 'client', content: 'Understood. I have two suitcases, is that fine?', timestamp: new Date(now.getTime() - 300000).toISOString() },
            { from: 'driver', content: 'Absolutely, the van has ample luggage space. I am pulling up now.', timestamp: new Date(now.getTime() - 120000).toISOString() },
        ];
        for (const msg of elenaMessages) {
            await redisClient.rPush(`messages:trip:${elenaTripId}`, JSON.stringify(msg));
        }
        await redisClient.expire(`messages:trip:${elenaTripId}`, 86400);

        const claraTripRes = await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            ['Clara', 'clara.mensah@who.int', 'Nairobi Serena Hotel', 'Wilson Airport', now, 'in_progress', driverIds['Faith Wambui'], vehicleIds['KDD 004D']]
        );
        const claraTripId = claraTripRes.rows[0].id;
        // Session with ~45 min remaining — amber TTL bar
        await redisClient.set(`session:trip:${claraTripId}:client`, JSON.stringify({ tripId: claraTripId, clientName: 'Clara', status: 'active' }), { EX: 2700 });
        await redisClient.set(`session:trip:${claraTripId}:driver`, JSON.stringify({ tripId: claraTripId, driverId: driverIds['Faith Wambui'], status: 'active' }), { EX: 2700 });

        const rafaelTripRes = await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            ['Rafael', 'r.costa@worldbank.org', 'Four Points Sheraton', 'JKIA Terminal 2', now, 'in_progress', driverIds['Kevin Mwangi'], vehicleIds['KDE 005E']]
        );
        const rafaelTripId = rafaelTripRes.rows[0].id;
        // Session with ~18 min remaining — red TTL bar
        await redisClient.set(`session:trip:${rafaelTripId}:client`, JSON.stringify({ tripId: rafaelTripId, clientName: 'Rafael', status: 'active' }), { EX: 1080 });
        await redisClient.set(`session:trip:${rafaelTripId}:driver`, JSON.stringify({ tripId: rafaelTripId, driverId: driverIds['Kevin Mwangi'], status: 'active' }), { EX: 1080 });

        // ── Completed ──────────────────────────────────────────────────────────
        const marcusPickup = new Date(yesterday); marcusPickup.setHours(14, 0, 0, 0);
        await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            ['Marcus', 'marcus.webb@techsummit.io', 'JKIA Terminal 2', 'Nairobi Serena Hotel', marcusPickup, 'completed', driverIds['James Kariuki'], vehicleIds['KDA 001A']]
        );

        // Priya — completed, complaint under investigation
        const priyaPickup = new Date(twoDaysAgo); priyaPickup.setHours(9, 0, 0, 0);
        const priyaTripRes = await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            ['Priya', 'priya.sharma@unhabitat.org', 'UN Gigiri Complex', 'Radisson Blu Nairobi', priyaPickup, 'completed', driverIds['Amina Osei'], vehicleIds['KDB 002B']]
        );
        const priyaTripId = priyaTripRes.rows[0].id;

        // Liang — completed, complaint open (just filed)
        const liangPickup = new Date(yesterday); liangPickup.setHours(8, 30, 0, 0);
        const liangTripRes = await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            ['Liang', 'liang.wei@ifc.org', 'JKIA Terminal 1A', 'Westlands, Nairobi', liangPickup, 'completed', driverIds['Peter Njoroge'], vehicleIds['KDC 003C']]
        );
        const liangTripId = liangTripRes.rows[0].id;

        // Sofía — completed, complaint resolved
        const sofiaPickup = new Date(threeDaysAgo); sofiaPickup.setHours(11, 0, 0, 0);
        const sofiaTripRes = await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            ['Sofía', 'sofia.ruiz@iaea.org', 'Safari Park Hotel', 'JKIA Terminal 1A', sofiaPickup, 'completed', driverIds['Faith Wambui'], vehicleIds['KDD 004D']]
        );
        const sofiaTripId = sofiaTripRes.rows[0].id;

        // James Omondi — completed, complaint window still open
        const jamesPickup = new Date(now); jamesPickup.setHours(6, 0, 0, 0);
        const jamesTripRes = await db.query(
            `INSERT INTO trips (client_first_name, client_corporate_email, pickup_location, destination, pickup_time, status, assigned_driver_id, vehicle_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            ['James', 'j.omondi@africacdc.org', 'JKIA Terminal 1A', 'Safari Park Hotel', jamesPickup, 'completed', driverIds['Kevin Mwangi'], vehicleIds['KDE 005E']]
        );
        const jamesTripId = jamesTripRes.rows[0].id;
        await redisClient.set(`complaint:window:${jamesTripId}`, JSON.stringify({ tripId: jamesTripId, expiresAt: new Date(now.getTime() + 86400000).toISOString() }), { EX: 86400 });

        // 7. Complaints — one per status for a complete complaints page view
        console.log('Seeding Complaints...');

        // Priya's complaint — under_investigation with encrypted message archive
        const priyaMessages = [
            { from: 'client', content: 'Hi, I have been waiting for 15 minutes. Where are you?', timestamp: new Date(priyaPickup).toISOString() },
            { from: 'driver', content: 'Apologies, I am stuck in traffic on Waiyaki Way. ETA 10 minutes.', timestamp: new Date(priyaPickup.getTime() + 60000).toISOString() },
            { from: 'client', content: 'This is unacceptable. I have a conference starting in 20 minutes.', timestamp: new Date(priyaPickup.getTime() + 120000).toISOString() },
            { from: 'driver', content: 'I understand. I am now 5 minutes away.', timestamp: new Date(priyaPickup.getTime() + 180000).toISOString() },
            { from: 'client', content: 'Please hurry.', timestamp: new Date(priyaPickup.getTime() + 240000).toISOString() },
            { from: 'driver', content: 'I am outside now. Blue Land Rover Discovery, KDB 002B.', timestamp: new Date(priyaPickup.getTime() + 300000).toISOString() },
        ];
        await db.query(
            `INSERT INTO complaints (trip_id, category, description, status, encrypted_message_archive)
             VALUES ($1,$2,$3,$4,$5)`,
            [priyaTripId, 'service_quality', 'Driver arrived 20 minutes late without prior notification. The delay caused me to miss the opening session of the conference.', 'under_investigation', encrypt(JSON.stringify(priyaMessages))]
        );

        // Liang's complaint — open (just filed, no investigation started)
        await db.query(
            `INSERT INTO complaints (trip_id, category, description, status)
             VALUES ($1,$2,$3,$4)`,
            [liangTripId, 'conduct', 'Driver was on a phone call for the majority of the journey. I found this unprofessional and uncomfortable.', 'open']
        );

        // Sofía's complaint — resolved
        const sofiaMessages = [
            { from: 'client', content: 'Are we going the right way? This does not look like the route to the airport.', timestamp: new Date(sofiaPickup).toISOString() },
            { from: 'driver', content: 'There is a diversion on Mombasa Road. I am taking the bypass, it is a few minutes longer.', timestamp: new Date(sofiaPickup.getTime() + 60000).toISOString() },
            { from: 'client', content: 'Please make sure I am at the airport by 13:00. My flight is at 14:30.', timestamp: new Date(sofiaPickup.getTime() + 120000).toISOString() },
        ];
        await db.query(
            `INSERT INTO complaints (trip_id, category, description, status, encrypted_message_archive)
             VALUES ($1,$2,$3,$4,$5)`,
            [sofiaTripId, 'route', 'Driver took an unannounced route diversion without explanation, causing concern about arrival time.', 'resolved', encrypt(JSON.stringify(sofiaMessages))]
        );

        // 8. Print summary
        console.log('\n✅ Seed complete');
        console.log('   Fleet Manager  : manager@fleetops.dev / FleetOps2026!');
        console.log('   Drivers        : james@fleetops.dev, amina@fleetops.dev, peter@fleetops.dev / Driver2026!');
        console.log('                    faith@fleetops.dev, kevin@fleetops.dev / Driver2026!');
        console.log('   Vehicles       : KDA 001A (Toyota Fielder), KDB 002B (Land Rover Discovery)');
        console.log('                    KDC 003C (Toyota HiAce), KDD 004D (Toyota Prado), KDE 005E (Toyota Corolla)');
        console.log('   Trips          : 2 pending, 2 accepted, 3 in_progress, 5 completed');
        console.log('   Complaints     : 1 open, 1 under_investigation, 1 resolved');
        console.log('   Redis sessions : 3 active trip sessions (TTL: 2h / 45m / 18m), 1 complaint window');
        console.log('   Chat history   : 5 messages seeded for Elena/Peter trip (driver active trip view)\n');

    } catch (error) {
        console.error('❌ Failed to seed database:', error);
    } finally {
        await redisClient.quit();
        await db.end();
    }
}

runSeed();
