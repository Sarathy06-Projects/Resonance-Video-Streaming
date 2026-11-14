import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, pool } from './db';
import { runMigrations } from './migrate';
import roomsRouter from './routes/rooms';
import billingRouter from './routes/billing';
import { setupWebSocketServer } from './websocket';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Security: Disable x-powered-by header to prevent fingerprinting
app.disable('x-powered-by');

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// HTTP API Rate Limiter (Defense against DoS / Brute-force)
const ipRequestMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;

app.use('/api', (req, res, next) => {
  // Allow health check without rate limiting
  if (req.path === '/health') return next();

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = ipRequestMap.get(ip);

  if (!record || now > record.resetTime) {
    ipRequestMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }

  record.count++;
  next();
});

// Periodic cleanup of rate limit map
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestMap.entries()) {
    if (now > record.resetTime) {
      ipRequestMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

app.use(cors());
app.use(express.json({ limit: '100kb' })); // Bound request body size

// Health check endpoint (PRD Section 10.1)
app.get('/api/health', async (_req, res) => {
  try {
    const dbRes = await pool.query('SELECT 1 as alive');
    res.json({
      status: 'ok',
      service: 'Together Watch Party API',
      database: dbRes.rows.length > 0 ? 'connected (Neon PostgreSQL)' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (err: any) {
    console.error('[Health Check Error]', err);
    res.status(500).json({ status: 'error', database: 'Database unavailable' });
  }
});

// Mount API Routes
app.use('/api/rooms', roomsRouter);
app.use('/api/billing', billingRouter);

// Serve static frontend assets if built
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// SPA Fallback for /room/:roomId and others
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Together Watch Party - Frontend assets not built yet');
    }
  });
});

// Attach WebSockets
setupWebSocketServer(server);

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  console.log('[Together Server] Initializing...');
  const dbOk = await testConnection();
  if (dbOk) {
    console.log('[Together Server] Neon PostgreSQL verified successfully.');
    try {
      await runMigrations();
    } catch (e) {
      console.error('[Together Server] Migration check failed:', e);
    }
  } else {
    console.warn('[Together Server] Warning: Database connection issues detected.');
  }

  server.listen(PORT, () => {
    console.log(`[Together Server] 🚀 Full Application Running on http://localhost:${PORT}`);
    console.log(`[Together Server] 📡 WebSockets listening on ws://localhost:${PORT}/api/rooms/:roomId/connect`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { app, server };
