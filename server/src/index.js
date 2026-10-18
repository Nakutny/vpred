import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import categoryRoutes from './routes/categories.js';
import adminRoutes from './routes/admin.js';
import profileRoutes from './routes/profile.js';
import legalRoutes from './routes/legal.js';
import sitemapRoutes from './routes/sitemap.js';
import friendshipRoutes from './routes/friendships.js';
import messageRoutes from './routes/messages.js';
import blockRoutes from './routes/blocks.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import { visitorLogMiddleware } from './middleware/visitorLog.js';

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

// Visitor-Log-Middleware (loggt GET-Requests im Hintergrund)
visitorLogMiddleware(app);

app.get('/health', (req, res) => res.json({ status: 'ok', version: 'v6-patch21', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/legal', legalRoutes);
app.use('/sitemap.xml', sitemapRoutes);
app.use('/api/friendships', friendshipRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`vpred.org server running on port ${PORT} [v6-patch25]`);
});
