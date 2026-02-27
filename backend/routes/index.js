// ─────────────────────────────────────────────────────────────────────────────
// Route Aggregator — mounts all sub-routers under their canonical prefixes
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import authRouter from './auth.js';

const router = Router();

// Fleet manager authentication (login / logout)
router.use('/api/auth', authRouter);

export default router;
