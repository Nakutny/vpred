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
import { visitorLogMiddleware } from './middleware/visitorLog.js';
import { checkMaintenance } from './middleware/auth.js';
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
app.use(express.json({ limit: '2mb' }));

// Visitor-Log-Middleware (before maintenance check so traffic is always logged)
visitorLogMiddleware(app);

// Health check — always responds, even in maintenance
app.get('/health', (req, res) => res.json({ status: 'ok', version: 'v6-patch30', timestamp: new Date().toISOString() }));

// Maintenance mode check — intercepts all API calls for non-admins
app.use('/api', checkMaintenance);

// Public maintenance status endpoint (for frontend to check)
app.get('/api/maintenance', async (req, res) => {
  try {
    const result = await query('SELECT enabled, message, started_at, estimated_end FROM maintenance_mode WHERE id = 1');
    const mode = result.rows[0] || { enabled: false };
    res.json({ maintenance: mode.enabled || false, message: mode.message, started_at: mode.started_at, estimated_end: mode.estimated_end });
  } catch (_) {
    res.json({ maintenance: false });
  }
});

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

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── SMART CLEANUP SYSTEM ─────────────────────────────────────────────────────
async function scheduledCleanup() {
  try {
    await runCleanup();
  } catch (err) {
    console.error('[scheduled cleanup] Error:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`vpred.org server running on port ${PORT} [v6-patch30]`);
  scheduledCleanup();
  setInterval(scheduledCleanup, 30 * 60 * 1000);
});
