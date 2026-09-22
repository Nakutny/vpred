import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// PATCH /me routes MUST come before /:username

// PATCH /api/profile/me/bio
router.patch('/me/bio', requireAuth, async (req, res) => {
  try {
    const { bio } = req.body;
    if (bio && bio.length > 300) {
      return res.status(400).json({ error: 'Bio must be 300 characters or less.' });
    }
    await query('UPDATE users SET bio = $1 WHERE id = $2', [bio || null, req.user.id]);
    res.json({ message: 'Bio updated.' });
  } catch (err) {
    console.error('Update bio error:', err);
    res.status(500).json({ error: 'Failed to update bio.' });
  }
});

// PATCH /api/profile/me/password
router.patch('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    res.json({ message: 'Password updated.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// GET /api/profile/:username
router.get('/:username', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, bio, created_at FROM users WHERE LOWER(username) = LOWER($1)`,
      [req.params.username]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const posts = await query(
      `SELECT p.id, p.title, p.slug, p.summary, p.view_count, p.created_at,
              c.name as category_name, c.slug as category_slug,
              COUNT(DISTINCT pv.user_id) as vote_count,
              COUNT(DISTINCT cm.id) as comment_count
       FROM posts p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN post_votes pv ON pv.post_id = p.id
       LEFT JOIN comments cm ON cm.post_id = p.id AND cm.is_removed = FALSE
       WHERE p.author_id = $1 AND p.status = 'published'
       GROUP BY p.id, c.name, c.slug
       ORDER BY p.created_at DESC`,
      [result.rows[0].id]
    );

    res.json({ user: result.rows[0], posts: posts.rows });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

export default router;
