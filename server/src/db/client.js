import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,

  // ── Connection pool tuning for Render (single instance, low traffic) ──────
  max: 10,                // max concurrent connections (Supabase free tier: 60 max)
  min: 2,                 // keep 2 warm connections to avoid cold-start latency
  idleTimeoutMillis: 30_000,   // release idle connections after 30s
  connectionTimeoutMillis: 5_000, // fail fast if DB unreachable (5s)
  allowExitOnIdle: false, // keep pool alive between requests
});

pool.on('error', (err) => {
  console.error('[DB pool error]', err.message);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 800) {
    console.warn('[slow query]', duration + 'ms', text.slice(0, 80));
  }
  return res;
}

export async function getClient() {
  return pool.connect();
}

export default pool;
