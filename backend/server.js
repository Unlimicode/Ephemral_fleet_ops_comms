import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connect as connectDb } from './config/db.js';
import { connect as connectRedis } from './config/redis.js';
import router from './routes/index.js';
import transporter from './config/mailer.js';
const PORT = process.env.PORT || 3001;

export const app = express();
export const httpServer = createServer(app);

import { initIo, getIo } from './socket/io.js';
import { registerDashboardNamespace } from './socket/dashboardNamespace.js';

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isLocalNetwork = /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin) ||
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/.test(origin) ||
      /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/.test(origin);
    const isAllowed = origin === process.env.CLIENT_ORIGIN;
    if (isLocalhost || isLocalNetwork || isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(router);

// ── REST health check ─────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Socket.IO ─────────────────────────────────────────────────
initIo(httpServer);
registerDashboardNamespace(getIo());

// ── Start ─────────────────────────────────────────────────────
(async () => {
  await connectDb();
  await connectRedis();

  // Verify SMTP configuration on startup — fails loudly if MAIL_* vars are missing or wrong
  transporter.verify((error) => {
    if (error) {
      console.error('[mailer] SMTP configuration error — emails will not deliver:', error.message);
    } else {
      console.log('[mailer] SMTP connection verified — ready to send');
    }
  });

  httpServer.listen(PORT, () =>
    console.log(`[server] listening on http://localhost:${PORT}`)
  );
})();