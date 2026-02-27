// ─────────────────────────────────────────────────────────────────────────────
// Route Aggregator — mounts all sub-routers under their canonical prefixes
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import authRouter from './auth.js';
import tripsRouter from './trips.js';

const router = Router();

// Fleet manager authentication (login / logout)
router.use('/api/auth', authRouter);

// Trip management (fleet manager only)
router.use('/api/trips', tripsRouter);

export default router;
