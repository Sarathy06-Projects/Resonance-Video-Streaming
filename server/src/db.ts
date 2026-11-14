import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from server directory or root
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[DB Error] DATABASE_URL environment variable is missing.');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    // console.log('[DB Query]', { text: text.slice(0, 60), duration, rows: res.rowCount });
  }
  return res;
}

export async function testConnection(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db');
    console.log(`[Neon DB Connected] DB: ${res.rows[0].db}, Server Time: ${res.rows[0].now}`);
    return true;
  } catch (err) {
    console.error('[Neon DB Connection Error]', err);
    return false;
  }
}
