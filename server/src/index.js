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
import imageRoutes from './routes/images.js';
import uploadRoutes from './routes/upload.js';
import navCountsRoutes from './routes/navCounts.js';
import musicRoutes from './routes/music.js';
import { visitorLogMiddleware } from './middleware/visitorLog.js';
import { checkMaintenance } from './middleware/auth.js';
import { authLimiter, apiLimiter, donateLimiter } from './middleware/rateLimiter.js';
import { query } from './db/client.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://vpred.org',
    'https://www.vpred.org',
    /\.vpred\.org$/,
    'http://localhost:5173',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// ─── Visitor log ──────────────────────────────────────────────────────────────
app.use(visitorLogMiddleware);

// ─── Maintenance gate (blocks all /api routes for non-staff) ──────────────────
app.use('/api', checkMaintenance);

// ─── Rate limiters ────────────────────────────────────────────────────────────
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
app.use('/api/images', imageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/nav-counts', navCountsRoutes);
app.use('/api/music', musicRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Scheduled cleanup every 24h ─────────────────────────────────────────────
setInterval(runCleanup, 24 * 60 * 60 * 1000);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
