// ─────────────────────────────────────────────────────────────────────────────
// Route Aggregator — mounts all sub-routers under their canonical prefixes
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import authRouter from './auth.js';
import tripsRouter from './trips.js';
import bookingsRouter from './bookings.js';
import driversRouter from './drivers.js';
import driverTripsRouter from './driverTrips.js';
import rosterRouter from './roster.js';
import vehiclesRouter from './vehicles.js';
import dashboardRouter from './dashboard.js';
import pushRouter from './push.js';
import complaintsRouter from './complaints.js';
import contactRouter from './contact.js';
import flightsRouter from './flights.js';

const router = Router();

// Public booking requests
router.use('/api/bookings', bookingsRouter);

// Fleet manager authentication (login / logout)
router.use('/api/auth', authRouter);

// Trip management (fleet manager only)
router.use('/api/trips', tripsRouter);

// Driver mobile endpoints
router.use('/api/drivers', driversRouter);
router.use('/api/driver/trips', driverTripsRouter);

// Fleet Physical Roster endpoints
router.use('/api/roster', rosterRouter);
router.use('/api/vehicles', vehiclesRouter);

// Dashboard endpoints
router.use('/api/dashboard', dashboardRouter);

// Push notification endpoints
router.use('/api/push', pushRouter);

// Complaint management endpoints
router.use('/api/complaints', complaintsRouter);

// Public contact enquiries
router.use('/api/contact', contactRouter);

// Flight info (AviationStack proxy, Redis-cached)
router.use('/api/flights', flightsRouter);

export default router;
