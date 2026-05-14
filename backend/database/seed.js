import 'dotenv/config';
import db from '../config/db.js';
import redisClient from '../config/redis.js';
import bcrypt from 'bcryptjs';
import { encrypt } from '../utils/encryption.js';

// Convenience: build a Date offset from `now` by ±h hours / ±d days.
const hoursFromNow = (h) => new Date(Date.now() + h * 3600_000);
const daysFromNow  = (d) => new Date(Date.now() + d * 86400_000);
const minutesFromNow = (m) => new Date(Date.now() + m * 60_000);

async function runSeed() {
    console.log('🌱 Starting database seed process...');

    try {
        await redisClient.connect();
        console.log('[redis] Connected for seeding');

        console.log('Clearing existing data (Postgres & Redis)...');
        await redisClient.flushAll();
        await db.query(`DO $$ BEGIN DELETE FROM client_push_subscriptions; EXCEPTION WHEN undefined_table THEN NULL; END $$`);
        await db.query(`DO $$ BEGIN DELETE FROM direct_messages; EXCEPTION WHEN undefined_table THEN NULL; END $$`);
        await db.query(`DO $$ BEGIN DELETE FROM driver_notifications; EXCEPTION WHEN undefined_table THEN NULL; END $$`);
        await db.query(`DO $$ BEGIN DELETE FROM enquiries; EXCEPTION WHEN undefined_table THEN NULL; END $$`);
        await db.query(`DO $$ BEGIN DELETE FROM driver_password_resets; EXCEPTION WHEN undefined_table THEN NULL; END $$`);
        await db.query('DELETE FROM push_subscriptions');
        await db.query('DELETE FROM audit_log');
        await db.query('DELETE FROM complaints');
        await db.query('DELETE FROM trips');
        await db.query('DELETE FROM vehicles');
        await db.query('DELETE FROM drivers');
        await db.query('DELETE FROM fleet_managers');

        const managerPassword = await bcrypt.hash('FleetOps2026!', 10);
        const driverPassword  = await bcrypt.hash('Driver2026!',   10);

        // ── 1. Fleet manager ──────────────────────────────────────────────────
        console.log('Seeding Fleet Manager...');
        const fm = await db.query(
            `INSERT INTO fleet_managers (full_name, work_email, password_hash)
             VALUES ($1, $2, $3) RETURNING id`,
            ['Fleet Manager', 'manager@fleetops.dev', managerPassword]
        );
        const fmId = fm.rows[0].id;

        // ── 2. Drivers (7 total) ──────────────────────────────────────────────
        console.log('Seeding Drivers...');
        const driversData = [
            { name: 'James Kariuki',  email: 'james@fleetops.dev',   emp_id: 'DRV001', status: 'available' },
            { name: 'Amina Osei',     email: 'amina@fleetops.dev',   emp_id: 'DRV002', status: 'available' },
            { name: 'Peter Njoroge',  email: 'peter@fleetops.dev',   emp_id: 'DRV003', status: 'on_trip'   },
            { name: 'Faith Wambui',   email: 'faith@fleetops.dev',   emp_id: 'DRV004', status: 'on_trip'   },
            { name: 'Kevin Mwangi',   email: 'kevin@fleetops.dev',   emp_id: 'DRV005', status: 'on_trip'   },
            { name: 'Grace Achieng',  email: 'grace@fleetops.dev',   emp_id: 'DRV006', status: 'available' },
            { name: 'Daniel Mutiso',  email: 'daniel@fleetops.dev',  emp_id: 'DRV007', status: 'offline'   },
        ];

        const drv = {};
        for (const d of driversData) {
            const r = await db.query(
                `INSERT INTO drivers (fleet_manager_id, full_name, work_email, password_hash, employee_id)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [fmId, d.name, d.email, driverPassword, d.emp_id]
            );
            drv[d.name] = r.rows[0].id;
            await redisClient.set(
                `driver:availability:${r.rows[0].id}`,
                JSON.stringify({ status: d.status, updated_at: new Date().toISOString() }),
                { EX: 86400 }
            );
        }

        // ── 3. Vehicles (8 total) ─────────────────────────────────────────────
        console.log('Seeding Vehicles...');
        const vehiclesData = [
            { reg: 'KDA 001A', make: 'Toyota',     model: 'Fielder',   type: 'Sedan', cap: 4 },
            { reg: 'KDB 002B', make: 'Land Rover', model: 'Discovery', type: 'SUV',   cap: 7 },
            { reg: 'KDC 003C', make: 'Toyota',     model: 'HiAce',     type: 'Van',   cap: 12 },
            { reg: 'KDD 004D', make: 'Toyota',     model: 'Prado',     type: 'SUV',   cap: 7 },
            { reg: 'KDE 005E', make: 'Toyota',     model: 'Corolla',   type: 'Sedan', cap: 4 },
            { reg: 'KDF 006F', make: 'Mercedes',   model: 'E-Class',   type: 'Sedan', cap: 4 },
            { reg: 'KDG 007G', make: 'Nissan',     model: 'X-Trail',   type: 'SUV',   cap: 5 },
            { reg: 'KDH 008H', make: 'Toyota',     model: 'Coaster',   type: 'Bus',   cap: 24 },
        ];

        const veh = {};
        for (const v of vehiclesData) {
            const r = await db.query(
                `INSERT INTO vehicles (registration_number, make, model, type, capacity)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [v.reg, v.make, v.model, v.type, v.cap]
            );
            veh[v.reg] = r.rows[0].id;
        }

        // ── 4. Audit log: DRIVER_ADDED and VEHICLE_ADDED entries ─────────────
        for (const d of driversData) {
            await db.query(
                `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details, legal_basis, retention_category)
                 VALUES ('DRIVER_ADDED', $1, 'fleet_manager', $2, $3, 'Operational data', 'Operational')`,
                [fmId, drv[d.name], JSON.stringify({ full_name: d.name, employee_id: d.emp_id })]
            );
        }
        for (const v of vehiclesData) {
            await db.query(
                `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details, legal_basis, retention_category)
                 VALUES ('VEHICLE_ADDED', $1, 'fleet_manager', $2, $3, 'Operational data', 'Operational')`,
                [fmId, veh[v.reg], JSON.stringify({ registration: v.reg, make: v.make, model: v.model })]
            );
        }

        // ── 5. Trips (25 total) ───────────────────────────────────────────────
        console.log('Seeding Trips (25 records)...');

        // Helper: insert trip, optionally append matching audit entries.
        const insertTrip = async (data, audit = {}) => {
            const cols = Object.keys(data);
            const vals = Object.values(data);
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
            const r = await db.query(
                `INSERT INTO trips (${cols.join(',')}) VALUES (${placeholders}) RETURNING id`,
                vals
            );
            const tripId = r.rows[0].id;
            // Trip-level audit entries appropriate to its final status
            if (audit.assigned) {
                await db.query(
                    `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details, legal_basis, retention_category)
                     VALUES ('TRIP_ASSIGNED', $1, 'fleet_manager', $2, $3, 'Operational data', 'Operational')`,
                    [fmId, tripId, JSON.stringify({ driver_id: data.assigned_driver_id, vehicle_id: data.vehicle_id })]
                );
            }
            if (audit.accepted) {
                await db.query(
                    `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, legal_basis, retention_category)
                     VALUES ('TRIP_ACCEPTED', $1, 'driver', $2, 'Operational data', 'Operational')`,
                    [data.assigned_driver_id, tripId]
                );
            }
            if (audit.completed) {
                await db.query(
                    `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details, legal_basis, retention_category, destruction_hash)
                     VALUES ('TRIP_COMPLETED', $1, 'driver', $2, $3, 'DPA 2019 s.25 — Data Minimization', 'Ephemeral', $4)`,
                    [data.assigned_driver_id, tripId, JSON.stringify({ trip_id: tripId, completion_route: `${data.pickup_location} -> ${data.destination}` }), `sha256:${tripId.slice(0,12)}-${Date.now()}`]
                );
            }
            return tripId;
        };

        const tripIds = {};

        // — 3 Pending —
        tripIds.nadia = await insertTrip({
            client_first_name: 'Nadia', client_corporate_email: 'nadia.hassan@unep.org',
            pickup_location: 'JKIA Terminal 1A', destination: 'UNEP Gigiri Complex',
            pickup_time: hoursFromNow(20), status: 'pending', flight_number: 'ET304',
            notes: 'VIP delegation — please display name card on arrival',
            additional_info: 'Two large suitcases + carry-on. Quiet ride preferred.'
        });
        tripIds.tom = await insertTrip({
            client_first_name: 'Tom', client_corporate_email: 'tom.fletcher@weforum.org',
            pickup_location: 'Hilton Nairobi', destination: 'Village Market, Gigiri',
            pickup_time: hoursFromNow(28), status: 'pending'
        });
        tripIds.aisha = await insertTrip({
            client_first_name: 'Aisha', client_corporate_email: 'aisha.bello@afdb.org',
            pickup_location: 'JKIA Terminal 2', destination: 'Serena Hotel, Nairobi',
            pickup_time: hoursFromNow(36), status: 'pending', flight_number: 'KQ310',
            additional_info: 'Travelling with one infant — child seat required.'
        });

        // — 4 Accepted —
        tripIds.sarah = await insertTrip({
            client_first_name: 'Sarah', client_corporate_email: 'sarah.mitchell@techcorp.com',
            pickup_location: 'JKIA Terminal 1A', destination: 'Radisson Blu Hotel, Nairobi',
            pickup_time: hoursFromNow(15), status: 'accepted', flight_number: 'KQ101',
            assigned_driver_id: drv['James Kariuki'], vehicle_id: veh['KDA 001A'],
            eta: minutesFromNow(60)
        }, { assigned: true });
        tripIds.david = await insertTrip({
            client_first_name: 'David', client_corporate_email: 'david.okafor@unnairobi.org',
            pickup_location: 'UN Gigiri Complex', destination: 'JKIA Terminal 1A',
            pickup_time: hoursFromNow(20), status: 'accepted',
            assigned_driver_id: drv['Amina Osei'], vehicle_id: veh['KDB 002B'],
            eta: minutesFromNow(45)
        }, { assigned: true });
        tripIds.linda = await insertTrip({
            client_first_name: 'Linda', client_corporate_email: 'linda.park@samsung.com',
            pickup_location: 'Two Rivers Mall', destination: 'JKIA Terminal 2',
            pickup_time: hoursFromNow(8), status: 'accepted', flight_number: 'KQ764',
            assigned_driver_id: drv['Grace Achieng'], vehicle_id: veh['KDF 006F']
        }, { assigned: true });
        tripIds.malik = await insertTrip({
            client_first_name: 'Malik', client_corporate_email: 'malik.farah@unicef.org',
            pickup_location: 'Sankara Hotel, Westlands', destination: 'Wilson Airport',
            pickup_time: hoursFromNow(5), status: 'accepted',
            assigned_driver_id: drv['Daniel Mutiso'], vehicle_id: veh['KDG 007G']
        }, { assigned: true });

        // — 4 In Progress —
        tripIds.elena = await insertTrip({
            client_first_name: 'Elena', client_corporate_email: 'elena.vasquez@globalconf.com',
            pickup_location: 'Hilton Nairobi', destination: 'JKIA Terminal 1A',
            pickup_time: minutesFromNow(-10), status: 'in_progress',
            assigned_driver_id: drv['Peter Njoroge'], vehicle_id: veh['KDC 003C']
        }, { assigned: true, accepted: true });
        // 2h Redis session — full green TTL bar
        await redisClient.set(`session:trip:${tripIds.elena}:client`, JSON.stringify({ tripId: tripIds.elena, status: 'active' }), { EX: 7200 });
        await redisClient.set(`session:trip:${tripIds.elena}:driver`, JSON.stringify({ tripId: tripIds.elena, status: 'active' }), { EX: 7200 });

        tripIds.clara = await insertTrip({
            client_first_name: 'Clara', client_corporate_email: 'clara.mensah@who.int',
            pickup_location: 'Nairobi Serena Hotel', destination: 'Wilson Airport',
            pickup_time: minutesFromNow(-5), status: 'in_progress',
            assigned_driver_id: drv['Faith Wambui'], vehicle_id: veh['KDD 004D']
        }, { assigned: true, accepted: true });
        await redisClient.set(`session:trip:${tripIds.clara}:client`, JSON.stringify({ tripId: tripIds.clara, status: 'active' }), { EX: 2700 });
        await redisClient.set(`session:trip:${tripIds.clara}:driver`, JSON.stringify({ tripId: tripIds.clara, status: 'active' }), { EX: 2700 });

        tripIds.rafael = await insertTrip({
            client_first_name: 'Rafael', client_corporate_email: 'r.costa@worldbank.org',
            pickup_location: 'Four Points Sheraton', destination: 'JKIA Terminal 2',
            pickup_time: minutesFromNow(-2), status: 'in_progress',
            assigned_driver_id: drv['Kevin Mwangi'], vehicle_id: veh['KDE 005E']
        }, { assigned: true, accepted: true });
        await redisClient.set(`session:trip:${tripIds.rafael}:client`, JSON.stringify({ tripId: tripIds.rafael, status: 'active' }), { EX: 1080 });
        await redisClient.set(`session:trip:${tripIds.rafael}:driver`, JSON.stringify({ tripId: tripIds.rafael, status: 'active' }), { EX: 1080 });

        // Chat history for Elena (driver active trip screenshot)
        const elenaMessages = [
            { from: 'driver', content: 'Good morning, I am Peter. I am 5 minutes from the pickup point.', timestamp: minutesFromNow(-8).toISOString() },
            { from: 'client', content: 'Perfect, I am in the hotel lobby. How will I recognise you?', timestamp: minutesFromNow(-7).toISOString() },
            { from: 'driver', content: 'White Toyota HiAce, KDC 003C, at the main entrance.', timestamp: minutesFromNow(-6).toISOString() },
            { from: 'client', content: 'Understood. Two suitcases, OK?', timestamp: minutesFromNow(-5).toISOString() },
            { from: 'driver', content: 'Plenty of space. Pulling up now.', timestamp: minutesFromNow(-2).toISOString() },
        ];
        for (const msg of elenaMessages) {
            await redisClient.rPush(`messages:trip:${tripIds.elena}`, JSON.stringify(msg));
        }
        await redisClient.expire(`messages:trip:${tripIds.elena}`, 86400);

        // — 14 Completed (clean) ──────────────────────────────────────────────
        const cleanCompleted = [
            { name: 'Marcus',  email: 'marcus.webb@techsummit.io',     pickup: 'JKIA Terminal 2',        dest: 'Nairobi Serena Hotel',  driver: 'James Kariuki', vehicle: 'KDA 001A', offsetH: -22 },
            { name: 'Jin',     email: 'jin.tanaka@toyota.co.jp',       pickup: 'Hilton Nairobi',         dest: 'JKIA Terminal 1A',      driver: 'Amina Osei',    vehicle: 'KDB 002B', offsetH: -26 },
            { name: 'Adaeze',  email: 'a.okonkwo@africau.edu',          pickup: 'Wilson Airport',         dest: 'Two Rivers Mall',       driver: 'Peter Njoroge', vehicle: 'KDC 003C', offsetH: -30 },
            { name: 'Lukas',   email: 'lukas.weber@bmw.de',             pickup: 'JKIA Terminal 1A',       dest: 'Crowne Plaza Nairobi',  driver: 'Faith Wambui',  vehicle: 'KDD 004D', offsetH: -34 },
            { name: 'Mei',     email: 'mei.cheung@hsbc.com',            pickup: 'Westlands',              dest: 'JKIA Terminal 2',       driver: 'Kevin Mwangi',  vehicle: 'KDE 005E', offsetH: -40 },
            { name: 'Hassan',  email: 'hassan.ali@aramco.com',          pickup: 'Sankara Hotel',          dest: 'JKIA Terminal 1A',      driver: 'Grace Achieng', vehicle: 'KDF 006F', offsetH: -44 },
            { name: 'Olivia',  email: 'olivia.smith@unilever.com',      pickup: 'Village Market',         dest: 'Hilton Nairobi',        driver: 'James Kariuki', vehicle: 'KDA 001A', offsetH: -50 },
            { name: 'Hideo',   email: 'h.nakamura@sumitomo.co.jp',      pickup: 'JKIA Terminal 1A',       dest: 'InterContinental Nairobi', driver: 'Amina Osei', vehicle: 'KDB 002B', offsetH: -56 },
            { name: 'Anya',    email: 'anya.petrov@gazprom.ru',         pickup: 'JKIA Terminal 2',        dest: 'Radisson Blu',          driver: 'Daniel Mutiso', vehicle: 'KDG 007G', offsetH: -62 },
            { name: 'Theo',    email: 'theo.dubois@totalenergies.com',  pickup: 'Hilton Nairobi',         dest: 'Wilson Airport',        driver: 'Grace Achieng', vehicle: 'KDF 006F', offsetH: -68 },
        ];

        for (const t of cleanCompleted) {
            await insertTrip({
                client_first_name: t.name, client_corporate_email: t.email,
                pickup_location: t.pickup, destination: t.dest,
                pickup_time: hoursFromNow(t.offsetH), status: 'completed',
                assigned_driver_id: drv[t.driver], vehicle_id: veh[t.vehicle]
            }, { assigned: true, accepted: true, completed: true });
        }

        // — 4 Completed WITH complaint (in various states) ────────────────────
        // Priya — under_investigation, with encrypted archive + investigation notes
        const priyaPickup = hoursFromNow(-48);
        const priyaTripId = await insertTrip({
            client_first_name: 'Priya', client_corporate_email: 'priya.sharma@unhabitat.org',
            pickup_location: 'UN Gigiri Complex', destination: 'Radisson Blu Nairobi',
            pickup_time: priyaPickup, status: 'completed',
            assigned_driver_id: drv['Amina Osei'], vehicle_id: veh['KDB 002B']
        }, { assigned: true, accepted: true, completed: true });
        tripIds.priya = priyaTripId;
        await redisClient.set(`complaint:window:${priyaTripId}`, JSON.stringify({ active: true }), { EX: 64800 });

        // Liang — open complaint, no investigation yet
        const liangTripId = await insertTrip({
            client_first_name: 'Liang', client_corporate_email: 'liang.wei@ifc.org',
            pickup_location: 'JKIA Terminal 1A', destination: 'Westlands, Nairobi',
            pickup_time: hoursFromNow(-22), status: 'completed',
            assigned_driver_id: drv['Peter Njoroge'], vehicle_id: veh['KDC 003C']
        }, { assigned: true, accepted: true, completed: true });
        tripIds.liang = liangTripId;
        await redisClient.set(`complaint:window:${liangTripId}`, JSON.stringify({ active: true }), { EX: 64800 });

        // Sofía — resolved
        const sofiaTripId = await insertTrip({
            client_first_name: 'Sofía', client_corporate_email: 'sofia.ruiz@iaea.org',
            pickup_location: 'Safari Park Hotel', destination: 'JKIA Terminal 1A',
            pickup_time: hoursFromNow(-72), status: 'completed',
            assigned_driver_id: drv['Faith Wambui'], vehicle_id: veh['KDD 004D']
        }, { assigned: true, accepted: true, completed: true });
        tripIds.sofia = sofiaTripId;

        // James — under_investigation, with notes
        const jamesTripId = await insertTrip({
            client_first_name: 'James', client_corporate_email: 'j.omondi@africacdc.org',
            pickup_location: 'JKIA Terminal 1A', destination: 'Safari Park Hotel',
            pickup_time: hoursFromNow(-14), status: 'completed',
            assigned_driver_id: drv['Kevin Mwangi'], vehicle_id: veh['KDE 005E']
        }, { assigned: true, accepted: true, completed: true });
        tripIds.james = jamesTripId;
        await redisClient.set(`complaint:window:${jamesTripId}`, JSON.stringify({ active: true }), { EX: 30000 });

        // ── 6. Complaints ─────────────────────────────────────────────────────
        console.log('Seeding Complaints...');

        const priyaMessages = [
            { from: 'client', content: 'Hi, I have been waiting for 15 minutes. Where are you?', timestamp: priyaPickup.toISOString() },
            { from: 'driver', content: 'Apologies, stuck in traffic on Waiyaki Way. ETA 10 minutes.', timestamp: new Date(priyaPickup.getTime() + 60000).toISOString() },
            { from: 'client', content: 'This is unacceptable. I have a conference starting in 20 minutes.', timestamp: new Date(priyaPickup.getTime() + 120000).toISOString() },
            { from: 'driver', content: 'I understand. Now 5 minutes away.', timestamp: new Date(priyaPickup.getTime() + 180000).toISOString() },
            { from: 'client', content: 'Please hurry.', timestamp: new Date(priyaPickup.getTime() + 240000).toISOString() },
            { from: 'driver', content: 'Outside now. Blue Land Rover Discovery, KDB 002B.', timestamp: new Date(priyaPickup.getTime() + 300000).toISOString() },
        ];
        await db.query(
            `INSERT INTO complaints (trip_id, category, description, status, encrypted_message_archive, investigation_notes)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
                priyaTripId, 'service_quality',
                'Driver arrived 20 minutes late without prior notification. The delay caused me to miss the opening session of the conference.',
                'under_investigation',
                encrypt(JSON.stringify(priyaMessages)),
                'Spoke with Amina. Confirmed Waiyaki Way had a major incident that morning — there were no advance notices on the operations channel. Following up with driver coaching on proactive ETA updates and pushing a roster-wide reminder to send delay messages via the in-app channel immediately on departure delay.'
            ]
        );

        await db.query(
            `INSERT INTO complaints (trip_id, category, description, status)
             VALUES ($1,$2,$3,$4)`,
            [
                liangTripId, 'conduct',
                'Driver was on a phone call for the majority of the journey. I found this unprofessional and uncomfortable.',
                'open'
            ]
        );

        const sofiaMessages = [
            { from: 'client', content: 'Are we going the right way? This does not look like the route to the airport.', timestamp: hoursFromNow(-72).toISOString() },
            { from: 'driver', content: 'There is a diversion on Mombasa Road. Taking the bypass, slightly longer.', timestamp: hoursFromNow(-71.95).toISOString() },
            { from: 'client', content: 'Please make sure I am at the airport by 13:00.', timestamp: hoursFromNow(-71.9).toISOString() },
        ];
        await db.query(
            `INSERT INTO complaints (trip_id, category, description, status, encrypted_message_archive, investigation_notes)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
                sofiaTripId, 'route',
                'Driver took an unannounced route diversion without explanation, causing concern about arrival time.',
                'resolved',
                encrypt(JSON.stringify(sofiaMessages)),
                'Reviewed the in-app message archive — driver did communicate the diversion was due to a Mombasa Road incident. Recommendation accepted: drivers must announce diversions before turning, not after. Client notified of resolution by email.'
            ]
        );

        const jamesMessages = [
            { from: 'driver', content: 'Hello James, I am outside Terminal 1A. White Toyota Corolla, KDE 005E.', timestamp: hoursFromNow(-14).toISOString() },
            { from: 'client', content: 'Coming out now.', timestamp: hoursFromNow(-13.95).toISOString() },
        ];
        await db.query(
            `INSERT INTO complaints (trip_id, category, description, status, encrypted_message_archive, investigation_notes)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
                jamesTripId, 'vehicle_condition',
                'The air conditioning was not working and the journey was uncomfortable in the heat.',
                'under_investigation',
                encrypt(JSON.stringify(jamesMessages)),
                'Vehicle KDE 005E flagged for maintenance check — AC service scheduled this afternoon. Holding the vehicle from rotation until cleared.'
            ]
        );

        // ── 7. Enquiries (12 mix of statuses) ─────────────────────────────────
        console.log('Seeding Enquiries...');
        const enquiries = [
            { name: 'Alex Carter',   company: 'Carter Logistics',   email: 'alex@carterlog.com',    message: 'We move 6 staff trips daily across Nairobi and would like a managed corporate account.', status: 'new' },
            { name: 'Maya Iyer',     company: 'Iyer & Partners',    email: 'm.iyer@iyerpartners.co',message: 'Interested in airport transfers for visiting clients. Average 4 per week.', status: 'new' },
            { name: 'Tomás Castro',  company: 'Andes Coffee Co.',   email: 'tomas@andescoffee.co',  message: 'Need a fleet for a 3-day conference next month — 30 attendees.', status: 'new' },
            { name: 'Hana Lim',      company: 'Lim Trade House',    email: 'hana@limtrade.kr',      message: 'Setting up regional HQ in Nairobi. Need a recurring transport partner.', status: 'read' },
            { name: 'Joseph Otieno', company: 'EcoSpark Energy',    email: 'jotieno@ecospark.ke',   message: 'Looking at exec airport transfers — what is your pricing structure?', status: 'read' },
            { name: 'Diana Brooks',  company: 'Brooks Audit LLP',   email: 'd.brooks@brooksaudit.com', message: 'We have a 2-week audit engagement starting June; need daily transport for 3 partners.', status: 'read' },
            { name: 'Yusuf Ahmed',   company: 'Al-Madinah Trading', email: 'yusuf@almadinah.ae',    message: 'Privacy-first transport is exactly what we need for our delegation. Demo possible?', status: 'responded' },
            { name: 'Linda Park',    company: 'Samsung E. Africa',  email: 'l.park@samsung.com',    message: 'Onboarded 14 staff so far — great experience. Adding two more next week.', status: 'responded' },
            { name: 'Eduardo Salas', company: 'Salas & Co.',        email: 'eduardo@salasco.mx',    message: 'Inquiry about white-label use of the platform for our own fleet.', status: 'responded' },
            { name: 'Naledi Khumalo',company: 'Khumalo Holdings',   email: 'naledi@khumalo.za',     message: 'How do you handle driver background checks?', status: 'new' },
            { name: 'Felix Stein',   company: 'Stein Imports GmbH', email: 'felix@steinimports.de', message: 'Need transport for a 5-person team during the auto-expo week.', status: 'new' },
            { name: 'Priya Sharma',  company: 'UN Habitat',         email: 'priya.sharma@unhabitat.org', message: 'Following up on my earlier complaint — appreciate the responsiveness.', status: 'responded' },
        ];
        for (const e of enquiries) {
            await db.query(
                `INSERT INTO enquiries (name, company, email, message, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${Math.floor(Math.random() * 14)} days')`,
                [e.name, e.company, e.email, e.message, e.status]
            );
        }

        // ── 8. Direct messages (always-on threads) ────────────────────────────
        console.log('Seeding Direct Message threads...');

        // Driver ↔ Manager threads
        const driverThreads = [
            { driver: 'James Kariuki', exchange: [
                ['driver', 'Manager, KDA 001A needs new wiper blades — left side smearing badly.'],
                ['fleet_manager', 'Booked at the garage tomorrow 9am. You can take KDF 006F for today\'s pickup.'],
                ['driver', 'Got it, thank you.'],
            ]},
            { driver: 'Amina Osei', exchange: [
                ['driver', 'Hi, requesting Friday afternoon off — daughter\'s school event.'],
                ['fleet_manager', 'Approved. I\'ll have Grace cover the Westlands route.'],
                ['driver', 'Much appreciated 🙏'],
            ]},
            { driver: 'Peter Njoroge', exchange: [
                ['driver', 'Just dropped off Elena at JKIA T1A. Heading back to base.'],
                ['fleet_manager', 'Good. There is a pickup in the queue — accept when you are 5 minutes from town.'],
            ]},
            { driver: 'Daniel Mutiso', exchange: [
                ['fleet_manager', 'Daniel, you have been offline for a while. Everything OK?'],
                ['driver', 'Sorry, phone battery died. Back online now.'],
                ['fleet_manager', 'No problem. There is a pickup at Sankara at 5pm if you can take it.'],
                ['driver', 'On it.'],
            ]},
            { driver: 'Grace Achieng', exchange: [
                ['driver', 'KDF 006F has a low tyre pressure warning.'],
                ['fleet_manager', 'Top up at the next petrol stop — and log the reg + reading in the daily check sheet.'],
            ]},
        ];

        for (const t of driverThreads) {
            const dId = drv[t.driver];
            for (const [role, body] of t.exchange) {
                await db.query(
                    `INSERT INTO direct_messages (driver_id, sender_role, body, read_by_manager_at, read_by_recipient_at)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        dId, role, body,
                        role === 'driver' ? null : new Date(),
                        role === 'fleet_manager' ? null : new Date()
                    ]
                );
            }
        }

        // Client ↔ Manager threads (off-trip-style enquiries from past clients)
        const clientThreads = [
            { email: 'sarah.mitchell@techcorp.com', exchange: [
                ['client', 'Hi, do you offer recurring corporate accounts? We have weekly client visits.'],
                ['fleet_manager', 'Yes — I will send the corporate plan brief to your email today.'],
                ['client', 'Perfect, thank you.'],
            ]},
            { email: 'priya.sharma@unhabitat.org', exchange: [
                ['client', 'Following up on my complaint — is the investigation closed?'],
                ['fleet_manager', 'Still under investigation. I\'ll have an update by end of day.'],
            ]},
            { email: 'marcus.webb@techsummit.io', exchange: [
                ['fleet_manager', 'Hi Marcus, just confirming pickup at JKIA at 16:00 EAT today.'],
                ['client', 'Yes, all set. Thank you.'],
            ]},
            { email: 'r.costa@worldbank.org', exchange: [
                ['client', 'Will the trip include a brief stop at the Sheraton on the way?'],
                ['fleet_manager', 'Yes, I\'ve passed that on to Kevin. He\'ll confirm the stop with you in chat.'],
            ]},
            { email: 'olivia.smith@unilever.com', exchange: [
                ['client', 'Excellent service yesterday — passing this on to the office.'],
                ['fleet_manager', 'Thank you Olivia, much appreciated!'],
            ]},
            { email: 'nadia.hassan@unep.org', exchange: [
                ['client', 'Confirming a name card on arrival is essential — it is a sensitive delegation.'],
                ['fleet_manager', 'Noted — driver and vehicle will display the UNEP name card prominently.'],
            ]},
        ];

        for (const t of clientThreads) {
            for (const [role, body] of t.exchange) {
                await db.query(
                    `INSERT INTO direct_messages (client_email, sender_role, body, read_by_manager_at, read_by_recipient_at)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        t.email, role, body,
                        role === 'client' ? null : new Date(),
                        role === 'fleet_manager' ? null : new Date()
                    ]
                );
            }
        }

        // ── 9. Driver notifications (investigation notes) ─────────────────────
        console.log('Seeding Driver Notifications...');
        await db.query(
            `INSERT INTO driver_notifications (driver_id, trip_id, type, title, body)
             VALUES ($1, $2, 'investigation_note', 'Investigation note from Manager',
             'Spoke with you about the Waiyaki Way incident — pushing a roster-wide reminder to send delay messages via the in-app channel immediately on departure delay. Also added a one-on-one coaching note to your file (not a strike).')`,
            [drv['Amina Osei'], priyaTripId]
        );
        await db.query(
            `INSERT INTO driver_notifications (driver_id, trip_id, type, title, body)
             VALUES ($1, $2, 'investigation_note', 'Investigation note from Manager',
             'Vehicle KDE 005E is being held for an AC service this afternoon. You can take KDA 001A for the rest of the day. No fault attributed to you on this one.')`,
            [drv['Kevin Mwangi'], jamesTripId]
        );
        await db.query(
            `INSERT INTO driver_notifications (driver_id, type, title, body)
             VALUES ($1, 'direct_message', 'Message from Manager', 'Hi Daniel — your background check renewal is due next month, please come by the office Friday to sign the form.')`,
            [drv['Daniel Mutiso']]
        );

        // ── 10. Final audit-log signals for the dashboard story ──────────────
        // Compliance report uses these to compute its metrics.
        await db.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details, legal_basis, retention_category)
             VALUES ('COMPLAINT_FILED', $1, 'client', $2, $3, 'DPA 2019 s.25 — Data Minimization', 'Conditional')`,
            [priyaTripId, priyaTripId, JSON.stringify({ category: 'service_quality' })]
        );
        await db.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details, legal_basis, retention_category)
             VALUES ('COMPLAINT_STATUS_UPDATED', $1, 'fleet_manager', $2, $3, 'Operational data', 'Operational')`,
            [fmId, priyaTripId, JSON.stringify({ new_status: 'under_investigation' })]
        );
        await db.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details, legal_basis, retention_category)
             VALUES ('MESSAGE_ARCHIVE_ACCESSED', $1, 'fleet_manager', $2, $3, 'DPA 2019 s.30 — Accountability', 'Operational')`,
            [fmId, priyaTripId, JSON.stringify({ access_reason: 'investigation' })]
        );
        await db.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details, legal_basis, retention_category)
             VALUES ('COMPLAINT_FILED', $1, 'client', $2, $3, 'DPA 2019 s.25 — Data Minimization', 'Conditional')`,
            [sofiaTripId, sofiaTripId, JSON.stringify({ category: 'route' })]
        );
        await db.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details, legal_basis, retention_category)
             VALUES ('COMPLAINT_STATUS_UPDATED', $1, 'fleet_manager', $2, $3, 'Operational data', 'Operational')`,
            [fmId, sofiaTripId, JSON.stringify({ new_status: 'resolved' })]
        );

        // ── 11. Summary ──────────────────────────────────────────────────────
        console.log('\n✅ Seed complete');
        console.log('   Fleet Manager  : manager@fleetops.dev / FleetOps2026!');
        console.log('   Drivers        : 7 drivers — james, amina, peter, faith, kevin, grace, daniel @fleetops.dev / Driver2026!');
        console.log('   Vehicles       : 8 vehicles');
        console.log('   Trips          : 25 total — 3 pending, 4 accepted, 3 in_progress, 15 completed');
        console.log('   Complaints     : 4 — 1 open, 2 under_investigation, 1 resolved');
        console.log('   Enquiries      : 12 — 5 new, 3 read, 4 responded');
        console.log('   DM threads     : 5 driver↔manager, 6 client↔manager');
        console.log('   Investigation  : 2 driver notifications with manager notes\n');

    } catch (error) {
        console.error('❌ Failed to seed database:', error);
    } finally {
        await redisClient.quit();
        await db.end();
    }
}

runSeed();
