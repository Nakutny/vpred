import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// PATCH-Routen MÜSSEN vor /:username kommen

router.patch('/me/avatar', requireAuth, async (req, res) => {
  try {
    // Banned users cannot change their avatar
    if (req.user.is_banned) {
      const expired = req.user.ban_expires_at && new Date(req.user.ban_expires_at) <= new Date();
      if (!expired) {
        return res.status(403).json({ error: 'Your account is suspended. You cannot change your avatar.' });
      }
    }
    const { avatar_url } = req.body;
    // Accept R2 URLs (https://...), proxy paths (/api/images/...), preset SVG paths (/avatars/...),
    // and data: URLs as fallback (e.g. preset SVGs rendered as data URLs)
    if (avatar_url) {
      const isValid =
        avatar_url.startsWith('https://') ||
        avatar_url.startsWith('http://') ||
        avatar_url.startsWith('/api/images/') ||
        avatar_url.startsWith('/avatars/') ||
        avatar_url.startsWith('data:image') ||
        avatar_url.startsWith('data:application/octet-stream');
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid avatar format.' });
      }
      // Size check only for base64 data URLs (R2 URLs are just short strings)
      if (avatar_url.startsWith('data:')) {
        const sizeKB = Buffer.byteLength(avatar_url, 'utf8') / 1024;
        if (sizeKB > 500) return res.status(400).json({ error: 'Image too large. Max 500KB.' });
      }
    }
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatar_url || null, req.user.id]);
    res.json({ message: 'Avatar updated.', avatar_url: avatar_url || null });
  } catch (err) {
    console.error('Update avatar error:', err);
    res.status(500).json({ error: 'Failed to update avatar.' });
  }
});

router.patch('/me/bio', requireAuth, async (req, res) => {
  try {
    // Banned users cannot change their bio
    if (req.user.is_banned) {
      const expired = req.user.ban_expires_at && new Date(req.user.ban_expires_at) <= new Date();
      if (!expired) {
        return res.status(403).json({ error: 'Your account is suspended. You cannot change your bio.' });
      }
    }
    const { bio } = req.body;
    if (bio && bio.length > 300) return res.status(400).json({ error: 'Bio must be 300 characters or less.' });
    await query('UPDATE users SET bio = $1 WHERE id = $2', [bio || null, req.user.id]);
    res.json({ message: 'Bio updated.' });
  } catch (err) {
    console.error('Update bio error:', err);
    res.status(500).json({ error: 'Failed to update bio.' });
  }
});

router.patch('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both current and new password are required.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });
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
      `SELECT id, username, bio, avatar_url, created_at, is_banned, ban_expires_at, pre_ban_bio, pre_ban_avatar_url FROM users WHERE LOWER(username) = LOWER($1)`,
      [req.params.username]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found.' });

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

// ─── PATCH /api/profile — general profile update (donator settings etc.) ─────
router.patch('/', requireAuth, async (req, res) => {
  try {
    const { donator_badge_visible } = req.body;
    const updates = [];
    const vals = [];
    let idx = 1;

    if (typeof donator_badge_visible === 'boolean') {
      updates.push(`donator_badge_visible = $${idx++}`);
      vals.push(donator_badge_visible);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }

    vals.push(req.user.id);
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
      vals
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
