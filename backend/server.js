import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { connect as connectDb } from './config/db.js';
import { connect as connectRedis } from './config/redis.js';
import router from './routes/index.js';
const PORT = process.env.PORT || 3001;

const app = express();
const httpServer = createServer(app);

import { initIo } from './socket/io.js';

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(router);

// ── REST health check ─────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Socket.IO ─────────────────────────────────────────────────
initIo(httpServer);

// ── Start ─────────────────────────────────────────────────────
(async () => {
  await connectDb();
  await connectRedis();
  httpServer.listen(PORT, () =>
    console.log(`[server] listening on http://localhost:${PORT}`)
  );
})();
