import express from 'express';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, posts, comments, warnings] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query("SELECT COUNT(*) FROM posts WHERE status = 'published'"),
      query('SELECT COUNT(*) FROM comments WHERE is_removed = FALSE'),
      query('SELECT COUNT(*) FROM user_warnings'),
    ]);

    res.json({
      users: parseInt(users.rows[0].count),
      posts: parseInt(posts.rows[0].count),
      comments: parseInt(comments.rows[0].count),
      warnings: parseInt(warnings.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load statistics.' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const search = req.query.search;
    let q = `SELECT id, username, email, role, is_banned, is_verified, created_at,
               (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as post_count,
               (SELECT COUNT(*) FROM user_warnings WHERE user_id = users.id) as warning_count
             FROM users`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      q += ` WHERE username ILIKE $1 OR email ILIKE $1`;
    }
    q += ' ORDER BY created_at DESC LIMIT 100';
    const result = await query(q, params);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

// GET /api/admin/users/:id  — full user detail
router.get('/users/:id', async (req, res) => {
  try {
    const userResult = await query(
      `SELECT id, username, email, role, is_banned, is_verified, bio, avatar_url, created_at,
              (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as post_count,
              (SELECT COUNT(*) FROM comments WHERE author_id = users.id) as comment_count
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!userResult.rows[0]) return res.status(404).json({ error: 'User not found.' });

    const warningsResult = await query(
      `SELECT uw.id, uw.reason, uw.created_at, u.username as warned_by_username
       FROM user_warnings uw
       LEFT JOIN users u ON uw.warned_by = u.id
       WHERE uw.user_id = $1
       ORDER BY uw.created_at DESC`,
      [req.params.id]
    );

    const postsResult = await query(
      `SELECT id, title, slug, status, type, created_at, view_count
       FROM posts WHERE author_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.params.id]
    );

    res.json({
      user: userResult.rows[0],
      warnings: warningsResult.rows,
      recentPosts: postsResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load user details.' });
  }
});

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { banned } = req.body;
    if (req.params.id === String(req.user.id)) {
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
    if (req.params.id === String(req.user.id) && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot demote yourself.' });
    }
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
    res.json({ message: 'Role updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role.' });
  }
});

// DELETE /api/admin/users/:id  — delete account
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === String(req.user.id)) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }
    // Anonymise posts instead of hard-deleting them (content integrity)
    await query(
      `UPDATE posts SET author_id = NULL WHERE author_id = $1`,
      [req.params.id]
    );
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User account deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// POST /api/admin/users/:id/warn
router.post('/users/:id/warn', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ error: 'A warning reason is required.' });
    }
    await query(
      'INSERT INTO user_warnings (user_id, reason, warned_by) VALUES ($1, $2, $3)',
      [req.params.id, reason.trim(), req.user.id]
    );
    res.json({ message: 'Warning issued.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to issue warning.' });
  }
});

// DELETE /api/admin/warnings/:id  — remove a single warning
router.delete('/warnings/:id', async (req, res) => {
  try {
    await query('DELETE FROM user_warnings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Warning removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove warning.' });
  }
});

// GET /api/admin/posts
router.get('/posts', async (req, res) => {
  try {
    const search = req.query.search;
    let q = `SELECT p.id, p.title, p.slug, p.status, p.type, p.view_count, p.created_at,
                    u.username as author_username
             FROM posts p
             LEFT JOIN users u ON p.author_id = u.id`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      q += ` WHERE p.title ILIKE $1 OR u.username ILIKE $1`;
    }
    q += ' ORDER BY p.created_at DESC LIMIT 100';
    const result = await query(q, params);
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

// DELETE /api/admin/posts/:id  — hard delete post
router.delete('/posts/:id', async (req, res) => {
  try {
    await query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Post permanently deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

// GET /api/admin/comments  — list recent comments for moderation
router.get('/comments', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.content, c.is_removed, c.created_at,
              u.username as author_username,
              p.title as post_title, p.slug as post_slug
       FROM comments c
       LEFT JOIN users u ON c.author_id = u.id
       LEFT JOIN posts p ON c.post_id = p.id
       ORDER BY c.created_at DESC LIMIT 100`
    );
    res.json({ comments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load comments.' });
  }
});

// PATCH /api/admin/comments/:id/remove
router.patch('/comments/:id/remove', async (req, res) => {
  try {
    const { removed } = req.body;
    await query('UPDATE comments SET is_removed = $1 WHERE id = $2', [removed, req.params.id]);
    res.json({ message: removed ? 'Comment removed.' : 'Comment restored.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update comment.' });
  }
});

export default router;
