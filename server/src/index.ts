import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, pool } from './db';
import roomsRouter from './routes/rooms';
import billingRouter from './routes/billing';
import { setupWebSocketServer } from './websocket';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

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
    res.status(500).json({ status: 'error', database: err.message });
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
