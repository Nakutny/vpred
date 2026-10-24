import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadToR2, deleteFromR2 } from '../lib/r2.js';

const router = express.Router();

// PATCH-Routen MÜSSEN vor /:username kommen

// PATCH /api/profile/me/avatar — upload avatar to R2
router.patch('/me/avatar', requireAuth, async (req, res) => {
  try {
    const { avatar_url } = req.body;

    let finalUrl = avatar_url || null;

    // If it's a base64 data URL, upload to R2
    if (avatar_url && avatar_url.startsWith('data:image')) {
      const matches = avatar_url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid image format.' });

      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');

      if (buffer.byteLength > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'Avatar too large. Max 2MB.' });
      }

      const ext = mimeType.split('/')[1]?.replace('+xml', '') || 'jpg';
      const uid = crypto.randomBytes(12).toString('hex');
      const key = `avatars/${uid}.${ext}`;
      await uploadToR2(key, buffer, mimeType);

      // Delete old avatar from R2 if it was an R2 path
      const oldRes = await query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
      const oldUrl = oldRes.rows[0]?.avatar_url;
      if (oldUrl && oldUrl.includes('/api/images/avatars/')) {
        const oldKey = oldUrl.split('/api/images/')[1];
        try { await deleteFromR2(oldKey); } catch (_) {}
      }

      const publicBase = process.env.R2_PUBLIC_URL;
      finalUrl = publicBase ? `${publicBase}/${key}` : `/api/images/${key}`;
    }

    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [finalUrl, req.user.id]);
    res.json({ message: 'Avatar updated.', avatar_url: finalUrl });
  } catch (err) {
    console.error('Update avatar error:', err);
    res.status(500).json({ error: 'Failed to update avatar.' });
  }
});

router.patch('/me/bio', requireAuth, async (req, res) => {
  try {
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

// GET /api/profile/:username — now includes donator_color
router.get('/:username', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, bio, avatar_url, created_at, donator_color, is_donator, donator_badge_visible
       FROM users WHERE LOWER(username) = LOWER($1)`,
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

// PATCH /api/profile — general profile update (donator settings etc.)
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
