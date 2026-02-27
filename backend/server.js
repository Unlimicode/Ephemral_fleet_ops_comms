import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { connect as connectDb } from './config/db.js';
import { connect as connectRedis } from './config/redis.js';

const PORT = process.env.PORT || 3001;

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' },
});

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// ── REST health check ─────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Socket.IO ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);
  socket.on('disconnect', () =>
    console.log(`[socket] client disconnected: ${socket.id}`)
  );
});

// ── Start ─────────────────────────────────────────────────────
(async () => {
  await connectDb();
  await connectRedis();
  httpServer.listen(PORT, () =>
    console.log(`[server] listening on http://localhost:${PORT}`)
  );
})();
