import express from 'express';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

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
    res.status(500).json({ error: 'Failed to load statistics.' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, email, role, is_banned, is_verified, is_donator, donator_color, created_at
       FROM users ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { banned } = req.body;
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot ban yourself.' });
    }
    await query('UPDATE users SET is_banned = $1 WHERE id = $2', [banned, req.params.id]);
    res.json({ message: banned ? 'User banned.' : 'User unbanned.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ban status.' });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
    res.json({ message: 'Role updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role.' });
  }
});

// PATCH /api/admin/users/:id/color
// Admin can set or reset any user's donator_color
router.patch('/users/:id/color', async (req, res) => {
  try {
    const { color } = req.body;
    // null / '' → reset
    const finalColor = (!color || color === 'null') ? null : color;

    if (finalColor !== null && !/^#[0-9A-Fa-f]{6}$/.test(finalColor)) {
      return res.status(400).json({ error: 'Invalid color. Must be #RRGGBB or null to reset.' });
    }

    await query('UPDATE users SET donator_color = $1 WHERE id = $2', [finalColor, req.params.id]);
    res.json({ ok: true, donator_color: finalColor });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update color.' });
  }
});

// GET /api/admin/posts
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
    res.status(500).json({ error: 'Failed to load posts.' });
  }
});

// PATCH /api/admin/posts/:id/status
router.patch('/posts/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['published', 'removed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    await query('UPDATE posts SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ message: 'Status updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

// Exported for scheduled cleanup in index.js
export async function runCleanup() {
  // Placeholder — extend with actual cleanup logic if needed
  // e.g. delete expired sessions, purge soft-deleted records older than X days
}

export default router;
