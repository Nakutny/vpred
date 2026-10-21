import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import categoryRoutes from './routes/categories.js';
import adminRoutes from './routes/admin.js';
import profileRoutes from './routes/profile.js';
import friendshipRoutes from './routes/friendships.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import usersRoutes from './routes/users.js';
import donateRoutes from './routes/donate.js';
import navCountsRoutes from './routes/navCounts.js';
import musicRoutes from './routes/music.js';
import blocksRoutes from './routes/blocks.js';
import legalRoutes from './routes/legal.js';
import moderatorRoutes from './routes/moderator.js';
import reportsRoutes from './routes/reports.js';
import sitemapRoutes from './routes/sitemap.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '25mb' })); // increased for mp3 base64

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

app.get('/health', (req, res) => res.json({ status: 'ok', version: 'v6-patch37', timestamp: new Date().toISOString() }));

app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/posts',         apiLimiter,  postRoutes);
app.use('/api/comments',      apiLimiter,  commentRoutes);
app.use('/api/categories',    apiLimiter,  categoryRoutes);
app.use('/api/admin',         apiLimiter,  adminRoutes);
app.use('/api/profile',       apiLimiter,  profileRoutes);
app.use('/api/friendships',   apiLimiter,  friendshipRoutes);
app.use('/api/messages',      apiLimiter,  messageRoutes);
app.use('/api/notifications', apiLimiter,  notificationRoutes);
app.use('/api/users',         apiLimiter,  usersRoutes);
app.use('/api/donate',        apiLimiter,  donateRoutes);
app.use('/api/nav-counts',    apiLimiter,  navCountsRoutes);
app.use('/api/music',         apiLimiter,  musicRoutes);
app.use('/api/blocks',        apiLimiter,  blocksRoutes);
app.use('/api/legal',         apiLimiter,  legalRoutes);
app.use('/api/mod',           apiLimiter,  moderatorRoutes);
app.use('/api/reports',       apiLimiter,  reportsRoutes);
app.use('/api/sitemap',       apiLimiter,  sitemapRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`vpred.org server running on port ${PORT} [v6-patch37]`);
});
