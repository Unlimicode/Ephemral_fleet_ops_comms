// ─────────────────────────────────────────────────────────────────────────────
// Route Aggregator — mounts all sub-routers under their canonical prefixes
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import authRouter from './auth.js';
import tripsRouter from './trips.js';
import bookingsRouter from './bookings.js';
import driversRouter from './drivers.js';
import driverTripsRouter from './driverTrips.js';

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

export default router;
