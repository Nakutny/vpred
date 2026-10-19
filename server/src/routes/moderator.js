import express from 'express';
import { query } from '../db/client.js';
import { requireAuth, requireModerator } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();
router.use(requireAuth, requireModerator);

async function modAuditLog(modId, action, targetType, targetId, details = {}) {
  try {
    await query(
      `INSERT INTO audit_log (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [modId, action, targetType || null, targetId ? String(targetId) : null, JSON.stringify(details)]
    );
  } catch (e) { console.error('Mod audit log error:', e.message); }
}

// ─── OVERVIEW STATS ───────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [openReports, bannedUsers, recentPosts] = await Promise.all([
      query("SELECT COUNT(*) FROM reports WHERE status = 'open'"),
      query("SELECT COUNT(*) FROM users WHERE is_banned = TRUE"),
      query("SELECT COUNT(*) FROM posts WHERE status = 'published' AND deleted_at IS NULL AND created_at > NOW() - INTERVAL '24 hours'"),
    ]);
    res.json({
      openReports: parseInt(openReports.rows[0].count),
      bannedUsers: parseInt(bannedUsers.rows[0].count),
      postsLast24h: parseInt(recentPosts.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Stats could not be loaded.' });
  }
});

// ─── USERS — Moderator can ban/unban only ────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const search = req.query.search;
    let q = `SELECT id, username, email, role, is_banned, ban_expires_at, is_verified, created_at,
               (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as post_count,
               (SELECT COUNT(*) FROM user_warnings WHERE user_id = users.id) as warning_count
             FROM users WHERE role = 'user'`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (username ILIKE $1 OR email ILIKE $1)`;
    }
    q += ' ORDER BY created_at DESC LIMIT 100';
    const result = await query(q, params);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error loading users.' });
  }
});

// Moderator ban — cannot ban admins or other moderators
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { banned, ban_duration_days } = req.body;
    if (req.params.id === String(req.user.id)) {
      return res.status(400).json({ error: 'You cannot ban yourself.' });
    }

    const targetRes = await query('SELECT id, username, role FROM users WHERE id = $1', [req.params.id]);
    if (!targetRes.rows[0]) return res.status(404).json({ error: 'User not found.' });
    const targetUser = targetRes.rows[0];

    if (['admin', 'moderator'].includes(targetUser.role)) {
      return res.status(403).json({ error: 'Moderators cannot ban admins or other moderators.' });
    }

    if (banned) {
      let banExpiresAt = null;
      let durationLabel = 'permanent';

      if (ban_duration_days != null && ban_duration_days > 0) {
        const expires = new Date();
        expires.setDate(expires.getDate() + parseInt(ban_duration_days));
        banExpiresAt = expires.toISOString();
        durationLabel = `${ban_duration_days} day${ban_duration_days === 1 ? '' : 's'}`;
      }

      await query(
        'UPDATE users SET is_banned = TRUE, ban_expires_at = $1 WHERE id = $2',
        [banExpiresAt, req.params.id]
      );

      const notifBody = banExpiresAt
        ? `Your account has been suspended for ${durationLabel} until ${new Date(banExpiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. During this time you cannot post or message other users.`
        : `Your account has been permanently suspended. You cannot post or message other users.`;

      await createNotification(req.params.id, 'ban', '🚫 Account Suspended', notifBody, null);
      await modAuditLog(req.user.id, 'mod_user_banned', 'user', req.params.id, { duration: durationLabel, ban_expires_at: banExpiresAt });

      res.json({ message: `${targetUser.username} banned (${durationLabel}).` });
    } else {
      await query('UPDATE users SET is_banned = FALSE, ban_expires_at = NULL WHERE id = $1', [req.params.id]);
      await createNotification(req.params.id, 'unban', '✅ Account Reactivated', 'Your account suspension has been lifted. You can now post and message other users again.', null);
      await modAuditLog(req.user.id, 'mod_user_unbanned', 'user', req.params.id);
      res.json({ message: `${targetUser.username} unbanned.` });
    }
  } catch (err) {
    console.error('Mod ban error:', err);
    res.status(500).json({ error: 'Ban failed.' });
  }
});

// Warn a user
router.post('/users/:id/warn', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Reason required.' });
    const targetRes = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (['admin', 'moderator'].includes(targetRes.rows[0]?.role)) {
      return res.status(403).json({ error: 'Moderators cannot warn admins or other moderators.' });
    }
    await query('INSERT INTO user_warnings (user_id, reason, warned_by) VALUES ($1, $2, $3)', [req.params.id, reason.trim(), req.user.id]);
    await modAuditLog(req.user.id, 'mod_user_warned', 'user', req.params.id, { reason: reason.trim() });
    res.json({ message: 'Warning issued.' });
  } catch (err) {
    res.status(500).json({ error: 'Error.' });
  }
});

// ─── POSTS — Moderator can edit/soft-delete/restore ──────────────────────────
router.get('/posts', async (req, res) => {
  try {
    const search = req.query.search;
    let q = `SELECT p.id, p.title, p.slug, p.status, p.type, p.view_count, p.created_at,
               u.username as author_username
             FROM posts p LEFT JOIN users u ON p.author_id = u.id
             WHERE p.deleted_at IS NULL`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (p.title ILIKE $1 OR u.username ILIKE $1)`;
    }
    q += ' ORDER BY p.created_at DESC LIMIT 100';
    const result = await query(q, params);
    res.json({ posts: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error.' });
  }
});

router.patch('/posts/:id', async (req, res) => {
  try {
    const post = await query('SELECT id, title FROM posts WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Post not found.' });

    const { title, content, summary, status } = req.body;
    await query(
      `UPDATE posts SET
         title = COALESCE($1, title),
         content = COALESCE($2, content),
         summary = COALESCE($3, summary),
         status = COALESCE($4, status),
         updated_at = NOW()
       WHERE id = $5`,
      [title || null, content || null, summary || null, status || null, req.params.id]
    );
    await modAuditLog(req.user.id, 'mod_post_edited', 'post', req.params.id, { title: post.rows[0].title });
    res.json({ message: 'Post updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Error.' });
  }
});

// Soft-delete a post
router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await query('SELECT title FROM posts WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Post not found.' });
    await query(
      `UPDATE posts SET deleted_at = NOW(), deleted_by = $1, status = 'removed' WHERE id = $2`,
      [req.user.id, req.params.id]
    );
    await modAuditLog(req.user.id, 'mod_post_deleted', 'post', req.params.id, { title: post.rows[0].title });
    res.json({ message: 'Post deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Error.' });
  }
});

// Restore a soft-deleted post
router.patch('/posts/:id/restore', async (req, res) => {
  try {
    await query(
      `UPDATE posts SET deleted_at = NULL, deleted_by = NULL, status = 'published' WHERE id = $1`,
      [req.params.id]
    );
    await modAuditLog(req.user.id, 'mod_post_restored', 'post', req.params.id);
    res.json({ message: 'Post restored.' });
  } catch (err) {
    res.status(500).json({ error: 'Error.' });
  }
});

// ─── REPORTS — View & resolve ─────────────────────────────────────────────────
router.get('/reports', async (req, res) => {
  try {
    const status = req.query.status || 'open';
    const result = await query(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
              u.username as reporter_username
       FROM reports r LEFT JOIN users u ON r.reporter_id = u.id
       WHERE r.status = $1 ORDER BY r.created_at DESC LIMIT 100`,
      [status]
    );
    res.json({ reports: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error.' });
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    await query(`UPDATE reports SET status = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3`, [status, req.user.id, req.params.id]);
    await modAuditLog(req.user.id, `mod_report_${status}`, 'report', req.params.id);
    res.json({ message: 'Report updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Error.' });
  }
});

// ─── SELF-DEMOTION: Moderator can voluntarily return to user role ─────────────
router.patch('/demote-self', async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(400).json({ error: 'Only moderators can use this endpoint.' });
    }
    await query("UPDATE users SET role = 'user' WHERE id = $1", [req.user.id]);
    await modAuditLog(req.user.id, 'mod_self_demoted', 'user', req.user.id);
    res.json({ message: 'Your role has been changed back to user.' });
  } catch (err) {
    res.status(500).json({ error: 'Error.' });
  }
});

export default router;
