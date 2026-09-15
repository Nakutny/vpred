import express from 'express';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Alle Routes brauchen Admin
router.use(requireAuth, requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, posts, comments] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query("SELECT COUNT(*) FROM posts WHERE status = 'published'"),
      query('SELECT COUNT(*) FROM comments WHERE is_removed = FALSE'),
    ]);

    res.json({
      users: parseInt(users.rows[0].count),
      posts: parseInt(posts.rows[0].count),
      comments: parseInt(comments.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, email, role, is_banned, is_verified, created_at
       FROM users ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

// PATCH /api/admin/users/:id/ban - User bannen/entbannen
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { banned } = req.body;
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Du kannst dich nicht selbst bannen' });
    }
    await query('UPDATE users SET is_banned = $1 WHERE id = $2', [banned, req.params.id]);
    res.json({ message: banned ? 'Benutzer gesperrt' : 'Benutzer entsperrt' });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Bannen' });
  }
});

// PATCH /api/admin/users/:id/role - Rolle ändern
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['member', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Ungültige Rolle' });
    }
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
    res.json({ message: 'Rolle aktualisiert' });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Ändern der Rolle' });
  }
});

// GET /api/admin/posts - alle Posts inkl. removed
router.get('/posts', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.title, p.slug, p.status, p.created_at,
              u.username as author_username
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       ORDER BY p.created_at DESC LIMIT 100`
    );
    res.json({ posts: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// PATCH /api/admin/posts/:id/status
router.patch('/posts/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['published', 'removed'].includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }
    await query('UPDATE posts SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ message: 'Status aktualisiert' });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

export default router;
