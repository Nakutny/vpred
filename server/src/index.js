import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import categoryRoutes from './routes/categories.js';
import adminRoutes, { runCleanup } from './routes/admin.js';
import moderatorRoutes from './routes/moderator.js';
import profileRoutes from './routes/profile.js';
import legalRoutes from './routes/legal.js';
import sitemapRoutes from './routes/sitemap.js';
import friendshipRoutes from './routes/friendships.js';
import messageRoutes from './routes/messages.js';
import blockRoutes from './routes/blocks.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import userRoutes from './routes/users.js';
import donateRoutes from './routes/donate.js';
import navCountsRoutes from './routes/navCounts.js';
import musicRoutes from './routes/music.js';
import { visitorLogMiddleware } from './middleware/visitorLog.js';
import { checkMaintenance } from './middleware/auth.js';
import { authLimiter, apiLimiter, donateLimiter } from './middleware/rateLimiter.js';
import { query } from './db/client.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  'https://vpred.org',
  'https://www.vpred.org',
  'http://localhost:5173',
  'http://localhost:4173',
];
if (process.env.CLIENT_URL) ALLOWED_ORIGINS.push(process.env.CLIENT_URL);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '30mb' })); // increased for base64-encoded MP3 uploads

// Visitor log (before everything)
visitorLogMiddleware(app);

// ─── Always-available endpoints (before maintenance gate) ─────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', version: 'v6-patch36', timestamp: new Date().toISOString() }));

// Public maintenance status — MUST be before checkMaintenance middleware
app.get('/api/maintenance', async (req, res) => {
  try {
    const result = await query('SELECT enabled, message, started_at, estimated_end FROM maintenance_mode WHERE id = 1');
    const mode = result.rows[0] || { enabled: false };
    res.json({
      maintenance: mode.enabled || false,
      message: mode.message || null,
      started_at: mode.started_at || null,
      estimated_end: mode.estimated_end || null,
    });
  } catch (_) {
    res.json({ maintenance: false });
  }
});

// ─── Maintenance gate (blocks all /api routes for non-staff) ──────────────────
app.use('/api', checkMaintenance);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/donate/create-payment', donateLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mod', moderatorRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/legal', legalRoutes);
app.use('/sitemap.xml', sitemapRoutes);
app.use('/api/friendships', friendshipRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/donate', donateRoutes);
app.use('/api/nav-counts', navCountsRoutes);
app.use('/api/music', musicRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Scheduled cleanup ────────────────────────────────────────────────────────
async function scheduledCleanup() {
  try { await runCleanup(); } catch (err) { console.error('[cleanup]', err.message); }
}

app.listen(PORT, () => {
  console.log(`vpred.org server running on port ${PORT} [v6-patch36]`);
  scheduledCleanup();
  setInterval(scheduledCleanup, 30 * 60 * 1000);

  // ─── Render cold-start prevention ───────────────────────────────────────────
  // Render free tier spins down after 15min inactivity — ping self every 14min
  // to stay warm and avoid 20-30s cold-start delays for users.
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  if (process.env.NODE_ENV === 'production') {
    setInterval(async () => {
      try {
        const { default: https } = await import('https');
        const url = new URL('/health', SELF_URL);
        const mod = url.protocol === 'https:' ? https : (await import('http')).default;
        mod.get(url.toString(), (res) => {
          res.resume(); // drain response
        }).on('error', () => {}); // silently ignore errors
      } catch (_) {}
    }, 14 * 60 * 1000); // every 14 minutes
  }
});
