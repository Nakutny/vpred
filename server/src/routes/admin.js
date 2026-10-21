import express from 'express';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { testMailConnection } from '../lib/mailer.js';
import { createNotification } from './notifications.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

async function auditLog(adminId, action, targetType, targetId, details = {}) {
  try {
    await query(
      `INSERT INTO audit_log (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, action, targetType || null, targetId ? String(targetId) : null, JSON.stringify(details)]
    );
  } catch (e) { console.error('Audit log error:', e.message); }
}

// ─── STATS ───────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, posts, comments, warnings, reports] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query("SELECT COUNT(*) FROM posts WHERE status = 'published' AND deleted_at IS NULL"),
      query('SELECT COUNT(*) FROM comments WHERE is_removed = FALSE'),
      query('SELECT COUNT(*) FROM user_warnings'),
      query("SELECT COUNT(*) FROM reports WHERE status = 'open'"),
    ]);
    res.json({
      users: parseInt(users.rows[0].count),
      posts: parseInt(posts.rows[0].count),
      comments: parseInt(comments.rows[0].count),
      warnings: parseInt(warnings.rows[0].count),
      openReports: parseInt(reports.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Stats could not be loaded.' });
  }
});

// ─── MAINTENANCE MODE ─────────────────────────────────────────────────────────
router.get('/maintenance', async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*, u.username as started_by_username
       FROM maintenance_mode m
       LEFT JOIN users u ON m.started_by = u.id
       WHERE m.id = 1`
    );
    res.json({ maintenance: result.rows[0] || { enabled: false } });
  } catch (err) {
    res.status(500).json({ error: 'Could not load maintenance status.' });
  }
});

router.patch('/maintenance', async (req, res) => {
  try {
    const { enabled, message, estimated_end } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled (boolean) is required.' });
    }

    if (enabled) {
      await query(
        `UPDATE maintenance_mode SET
           enabled = TRUE,
           message = COALESCE($1, message),
           started_at = NOW(),
           estimated_end = $2,
           started_by = $3
         WHERE id = 1`,
        [message || null, estimated_end || null, req.user.id]
      );
      await auditLog(req.user.id, 'maintenance_enabled', null, null, { message, estimated_end });
      res.json({ message: 'Maintenance mode enabled. The site is now inaccessible to regular users.' });
    } else {
      await query(
        `UPDATE maintenance_mode SET
           enabled = FALSE,
           started_at = NULL,
           estimated_end = NULL,
           started_by = NULL
         WHERE id = 1`,
        []
      );
      await auditLog(req.user.id, 'maintenance_disabled', null, null);
      res.json({ message: 'Maintenance mode disabled. The site is now accessible.' });
    }
  } catch (err) {
    console.error('Maintenance error:', err);
    res.status(500).json({ error: 'Could not update maintenance mode.' });
  }
});

// ─── DB STATUS & CLEANUP ─────────────────────────────────────────────────────
router.get('/db-status', async (req, res) => {
  try {
    const [
      visitorCount, auditCount, messagesCount, anomaliesCount, lastCleanup, cleanupHistory
    ] = await Promise.all([
      query('SELECT COUNT(*) FROM visitor_log'),
      query('SELECT COUNT(*) FROM audit_log'),
      query('SELECT COUNT(*) FROM messages'),
      query('SELECT COUNT(*) FROM anomalies'),
      query('SELECT * FROM db_cleanup_log ORDER BY ran_at DESC LIMIT 1'),
      query('SELECT * FROM db_cleanup_log ORDER BY ran_at DESC LIMIT 10'),
    ]);

    let dbSize = null;
    try {
      const sizeRes = await query(`SELECT pg_database_size(current_database()) as size`);
      dbSize = parseInt(sizeRes.rows[0].size);
    } catch (_) {}

    let tableSizes = [];
    try {
      const ts = await query(`
        SELECT relname as table_name,
               pg_total_relation_size(relid) as size_bytes,
               n_live_tup as row_estimate
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY size_bytes DESC
        LIMIT 15
      `);
      tableSizes = ts.rows;
    } catch (_) {}

    // Top IPs in visitor log (for HTTP request overview)
    let topIps = [];
    try {
      const ipRes = await query(`
        SELECT ip,
               COUNT(*) as total_requests,
               COUNT(DISTINCT path) as unique_paths,
               MAX(created_at) as last_seen,
               MIN(created_at) as first_seen
        FROM visitor_log
        GROUP BY ip
        ORDER BY total_requests DESC
        LIMIT 20
      `);
      topIps = ipRes.rows;
    } catch (_) {}

    // Recent HTTP requests sample
    let recentRequests = [];
    try {
      const rr = await query(`
        SELECT vl.ip, vl.path, vl.method, vl.status_code, vl.created_at,
               u.username
        FROM visitor_log vl
        LEFT JOIN users u ON vl.user_id = u.id
        ORDER BY vl.created_at DESC
        LIMIT 100
      `);
      recentRequests = rr.rows;
    } catch (_) {}

    res.json({
      visitor_log_count: parseInt(visitorCount.rows[0].count),
      audit_log_count: parseInt(auditCount.rows[0].count),
      messages_count: parseInt(messagesCount.rows[0].count),
      anomalies_count: parseInt(anomaliesCount.rows[0].count),
      db_size_bytes: dbSize,
      table_sizes: tableSizes,
      last_cleanup: lastCleanup.rows[0] || null,
      cleanup_history: cleanupHistory.rows,
      top_ips: topIps,
      recent_requests: recentRequests,
    });
  } catch (err) {
    console.error('DB status error:', err);
    res.status(500).json({ error: 'DB status could not be loaded.' });
  }
});

// Manual cleanup trigger
router.post('/db-cleanup', async (req, res) => {
  try {
    const result = await runCleanup();
    await auditLog(req.user.id, 'db_cleanup_manual', null, null, result);
    res.json({ message: 'Cleanup completed.', ...result });
  } catch (err) {
    console.error('Cleanup error:', err);
    res.status(500).json({ error: 'Cleanup failed.' });
  }
});

// ─── ANOMALIES ───────────────────────────────────────────────────────────────
router.get('/anomalies', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, source, data, reason, created_at FROM anomalies ORDER BY created_at DESC LIMIT 500`
    );
    res.json({ anomalies: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Could not load anomalies.' });
  }
});

router.delete('/anomalies/:id', async (req, res) => {
  try {
    await query('DELETE FROM anomalies WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'anomaly_deleted', 'anomaly', req.params.id);
    res.json({ message: 'Anomaly deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete anomaly.' });
  }
});

router.delete('/anomalies', async (req, res) => {
  try {
    const result = await query('DELETE FROM anomalies');
    await auditLog(req.user.id, 'anomalies_cleared', null, null, { count: result.rowCount });
    res.json({ message: `${result.rowCount} anomalies deleted.` });
  } catch (err) {
    res.status(500).json({ error: 'Could not clear anomalies.' });
  }
});

// ─── USERS ───────────────────────────────────────────────────────────────────
router.get('/users/export/csv', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, email, role, is_banned, is_verified, created_at,
              (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as post_count
       FROM users ORDER BY created_at DESC`
    );
    const headers = ['id','username','email','role','is_banned','is_verified','post_count','created_at'];
    const rows = result.rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(csv);
    await auditLog(req.user.id, 'users_exported_csv', null, null);
  } catch (err) { res.status(500).json({ error: 'Export failed.' }); }
});

router.get('/users', async (req, res) => {
  try {
    const search = req.query.search;
    let q = `SELECT id, username, email, role, is_banned, ban_expires_at, is_verified, created_at,
               (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as post_count,
               (SELECT COUNT(*) FROM user_warnings WHERE user_id = users.id) as warning_count
             FROM users`;
    const params = [];
    if (search) { params.push(`%${search}%`); q += ` WHERE username ILIKE $1 OR email ILIKE $1`; }
    q += ' ORDER BY created_at DESC LIMIT 200';
    const result = await query(q, params);
    res.json({ users: result.rows });
  } catch (err) { res.status(500).json({ error: 'Users could not be loaded.' }); }
});

router.get('/users/:id', async (req, res) => {
  try {
    const userResult = await query(
      `SELECT id, username, email, role, is_banned, ban_expires_at, is_verified, bio, avatar_url, created_at,
              (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as post_count,
              (SELECT COUNT(*) FROM comments WHERE author_id = users.id) as comment_count
       FROM users WHERE id = $1`, [req.params.id]
    );
    if (!userResult.rows[0]) return res.status(404).json({ error: 'User not found.' });
    const [warnings, posts, adminHistory] = await Promise.all([
      query(`SELECT uw.id, uw.reason, uw.created_at, u.username as warned_by_username
             FROM user_warnings uw LEFT JOIN users u ON uw.warned_by = u.id
             WHERE uw.user_id = $1 ORDER BY uw.created_at DESC`, [req.params.id]),
      query(`SELECT id, title, slug, status, type, created_at, view_count
             FROM posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT 20`, [req.params.id]),
      query(`SELECT al.action, al.target_type, al.created_at, u.username as admin_username
             FROM audit_log al LEFT JOIN users u ON al.admin_id = u.id
             WHERE al.target_id = $1 ORDER BY al.created_at DESC LIMIT 10`, [req.params.id]),
    ]);
    res.json({ user: userResult.rows[0], warnings: warnings.rows, recentPosts: posts.rows, adminHistory: adminHistory.rows });
  } catch (err) { res.status(500).json({ error: 'User details could not be loaded.' }); }
});

// PATCH /api/admin/users/:id/ban
// ban_duration_days: number of days, or 0/null for permanent
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { banned, ban_duration_days, reason } = req.body;
    if (req.params.id === String(req.user.id)) {
      return res.status(400).json({ error: 'You cannot ban yourself.' });
    }

    const targetRes = await query('SELECT id, username FROM users WHERE id = $1', [req.params.id]);
    if (!targetRes.rows[0]) return res.status(404).json({ error: 'User not found.' });
    const targetUser = targetRes.rows[0];

    if (banned) {
      let banExpiresAt = null;
      let durationLabel = 'permanent';

      const days = parseInt(ban_duration_days);
      if (!isNaN(days) && days > 0) {
        const expires = new Date();
        expires.setDate(expires.getDate() + days);
        banExpiresAt = expires.toISOString();
        durationLabel = `${days} day${days === 1 ? '' : 's'}`;
      }

      await query(
        'UPDATE users SET is_banned = TRUE, ban_expires_at = $1 WHERE id = $2',
        [banExpiresAt, req.params.id]
      );

      const reasonText = reason?.trim() ? `\n\nReason: ${reason.trim()}` : '';
      const restrictionsText = '\n\nRestrictions: You cannot post, comment, or message other users during this period.';

      const notifBody = banExpiresAt
        ? `Your account has been suspended for ${durationLabel} until ${new Date(banExpiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.${reasonText}${restrictionsText}`
        : `Your account has been permanently suspended.${reasonText}${restrictionsText}`;

      await createNotification(req.params.id, 'ban', '🚫 Account Suspended', notifBody, null);
      await auditLog(req.user.id, 'user_banned', 'user', req.params.id, { duration: durationLabel, ban_expires_at: banExpiresAt, reason: reason?.trim() || null });

      res.json({ message: `${targetUser.username} banned (${durationLabel}).` });
    } else {
      await query('UPDATE users SET is_banned = FALSE, ban_expires_at = NULL WHERE id = $1', [req.params.id]);
      await createNotification(req.params.id, 'unban', '✅ Account Reactivated', 'Your account suspension has been lifted. You can now post, comment, and message other users again.', null);
      await auditLog(req.user.id, 'user_unbanned', 'user', req.params.id);
      res.json({ message: `${targetUser.username} unbanned.` });
    }
  } catch (err) {
    console.error('Ban error:', err);
    res.status(500).json({ error: 'Ban failed.' });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user','moderator','admin'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    if (req.params.id === String(req.user.id) && role !== 'admin') return res.status(400).json({ error: 'You cannot demote yourself.' });
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
    await auditLog(req.user.id, 'role_changed', 'user', req.params.id, { role });
    res.json({ message: 'Role changed.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.patch('/users/:id/verify', async (req, res) => {
  try {
    const { verified } = req.body;
    await query('UPDATE users SET is_verified = $1 WHERE id = $2', [verified, req.params.id]);
    await auditLog(req.user.id, verified ? 'user_verified' : 'user_unverified', 'user', req.params.id);
    res.json({ message: verified ? 'Verified.' : 'Verification removed.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === String(req.user.id)) return res.status(400).json({ error: 'You cannot delete your own account.' });
    const userRes = await query('SELECT username FROM users WHERE id = $1', [req.params.id]);
    await query(`UPDATE posts SET author_id = NULL WHERE author_id = $1`, [req.params.id]);
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'user_deleted', 'user', req.params.id, { username: userRes.rows[0]?.username });
    res.json({ message: 'Account deleted.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.post('/users/:id/warn', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Reason required.' });
    await query('INSERT INTO user_warnings (user_id, reason, warned_by) VALUES ($1, $2, $3)', [req.params.id, reason.trim(), req.user.id]);
    await auditLog(req.user.id, 'user_warned', 'user', req.params.id, { reason: reason.trim() });
    res.json({ message: 'Warning issued.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.delete('/warnings/:id', async (req, res) => {
  try {
    await query('DELETE FROM user_warnings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Warning removed.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// ─── POSTS ───────────────────────────────────────────────────────────────────
router.get('/posts/export/csv', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.title, p.slug, p.type, p.status, p.view_count, p.created_at, u.username as author
       FROM posts p LEFT JOIN users u ON p.author_id = u.id ORDER BY p.created_at DESC`
    );
    const headers = ['id','title','slug','type','status','view_count','author','created_at'];
    const rows = result.rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="posts.csv"');
    res.send([headers.join(','), ...rows].join('\n'));
  } catch (err) { res.status(500).json({ error: 'Export failed.' }); }
});

router.get('/posts', async (req, res) => {
  try {
    const search = req.query.search;
    let q = `SELECT p.id, p.title, p.slug, p.status, p.type, p.view_count, p.created_at, p.deleted_at,
               u.username as author_username
             FROM posts p LEFT JOIN users u ON p.author_id = u.id
             WHERE p.deleted_at IS NULL`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (p.title ILIKE $1 OR u.username ILIKE $1)`;
    }
    q += ' ORDER BY p.created_at DESC LIMIT 200';
    const result = await query(q, params);
    res.json({ posts: result.rows });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.get('/posts/deleted', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.title, p.slug, p.status, p.type, p.view_count, p.created_at, p.deleted_at,
              u.username as author_username, d.username as deleted_by_username
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       LEFT JOIN users d ON p.deleted_by = d.id
       WHERE p.deleted_at IS NOT NULL
       ORDER BY p.deleted_at DESC LIMIT 200`
    );
    res.json({ posts: result.rows });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.patch('/posts/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['published','removed','draft'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    await query('UPDATE posts SET status = $1 WHERE id = $2', [status, req.params.id]);
    await auditLog(req.user.id, 'post_status_changed', 'post', req.params.id, { status });
    res.json({ message: 'Status changed.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    const postRes = await query('SELECT title FROM posts WHERE id = $1', [req.params.id]);
    await query(
      `UPDATE posts SET deleted_at = NOW(), deleted_by = $1, status = 'removed' WHERE id = $2`,
      [req.user.id, req.params.id]
    );
    await auditLog(req.user.id, 'post_deleted', 'post', req.params.id, { title: postRes.rows[0]?.title });
    res.json({ message: 'Post deleted (recoverable).' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.patch('/posts/:id/restore', async (req, res) => {
  try {
    await query(
      `UPDATE posts SET deleted_at = NULL, deleted_by = NULL, status = 'published' WHERE id = $1`,
      [req.params.id]
    );
    await auditLog(req.user.id, 'post_restored', 'post', req.params.id);
    res.json({ message: 'Post restored.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.delete('/posts/:id/permanent', async (req, res) => {
  try {
    const postRes = await query('SELECT title FROM posts WHERE id = $1', [req.params.id]);
    await query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'post_permanently_deleted', 'post', req.params.id, { title: postRes.rows[0]?.title });
    res.json({ message: 'Post permanently deleted.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.post('/posts/bulk', async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs.' });
    if (action === 'delete') {
      await query(
        `UPDATE posts SET deleted_at = NOW(), deleted_by = $1, status = 'removed' WHERE id = ANY($2::uuid[])`,
        [req.user.id, ids]
      );
      await auditLog(req.user.id, 'posts_bulk_deleted', null, null, { count: ids.length });
    } else if (action === 'remove') {
      await query(`UPDATE posts SET status = 'removed' WHERE id = ANY($1::uuid[])`, [ids]);
      await auditLog(req.user.id, 'posts_bulk_removed', null, null, { count: ids.length });
    } else if (action === 'publish') {
      await query(`UPDATE posts SET status = 'published' WHERE id = ANY($1::uuid[])`, [ids]);
    } else { return res.status(400).json({ error: 'Unknown action.' }); }
    res.json({ message: `${ids.length} posts processed.` });
  } catch (err) { res.status(500).json({ error: 'Bulk action failed.' }); }
});

// ─── KOMMENTARE ──────────────────────────────────────────────────────────────
router.get('/comments', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.content, c.is_removed, c.created_at,
              u.username as author_username, p.title as post_title, p.slug as post_slug
       FROM comments c LEFT JOIN users u ON c.author_id = u.id LEFT JOIN posts p ON c.post_id = p.id
       ORDER BY c.created_at DESC LIMIT 200`
    );
    res.json({ comments: result.rows });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.patch('/comments/:id/remove', async (req, res) => {
  try {
    const { removed } = req.body;
    await query('UPDATE comments SET is_removed = $1 WHERE id = $2', [removed, req.params.id]);
    await auditLog(req.user.id, removed ? 'comment_removed' : 'comment_restored', 'comment', req.params.id);
    res.json({ message: removed ? 'Removed.' : 'Restored.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────
router.get('/reports', async (req, res) => {
  try {
    const status = req.query.status || 'open';
    const result = await query(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
              u.username as reporter_username, res.username as resolved_by_username
       FROM reports r LEFT JOIN users u ON r.reporter_id = u.id LEFT JOIN users res ON r.resolved_by = res.id
       WHERE r.status = $1 ORDER BY r.created_at DESC LIMIT 100`,
      [status]
    );
    res.json({ reports: result.rows });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['resolved','dismissed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    await query(`UPDATE reports SET status = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3`, [status, req.user.id, req.params.id]);
    await auditLog(req.user.id, `report_${status}`, 'report', req.params.id);
    res.json({ message: 'Report updated.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// ─── AUDIT-LOG ───────────────────────────────────────────────────────────────
router.get('/audit-log', async (req, res) => {
  try {
    const result = await query(
      `SELECT al.id, al.action, al.target_type, al.target_id, al.details, al.created_at,
              u.username as admin_username
       FROM audit_log al LEFT JOIN users u ON al.admin_id = u.id
       ORDER BY al.created_at DESC LIMIT 200`
    );
    res.json({ entries: result.rows });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// ─── IP-SPERREN ──────────────────────────────────────────────────────────────
router.get('/ip-bans', async (req, res) => {
  try {
    const result = await query(
      `SELECT ib.id, ib.ip_address, ib.reason, ib.created_at, u.username as banned_by_username
       FROM ip_bans ib LEFT JOIN users u ON ib.banned_by = u.id ORDER BY ib.created_at DESC`
    );
    res.json({ bans: result.rows });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.post('/ip-bans', async (req, res) => {
  try {
    const { ip_address, reason } = req.body;
    if (!ip_address?.trim()) return res.status(400).json({ error: 'IP address required.' });
    await query(
      `INSERT INTO ip_bans (ip_address, reason, banned_by) VALUES ($1, $2, $3)
       ON CONFLICT (ip_address) DO UPDATE SET reason = $2`,
      [ip_address.trim(), reason?.trim() || null, req.user.id]
    );
    await auditLog(req.user.id, 'ip_banned', 'ip', ip_address.trim(), { reason });
    res.json({ message: 'IP banned.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

router.delete('/ip-bans/:id', async (req, res) => {
  try {
    await query('DELETE FROM ip_bans WHERE id = $1', [req.params.id]);
    res.json({ message: 'IP ban removed.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// ─── PRIVATE MESSAGES (Admin view) ───────────────────────────────────────────
router.get('/messages', async (req, res) => {
  try {
    const search = req.query.search || '';
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const offset = parseInt(req.query.offset) || 0;

    let q = `SELECT m.id, m.content, m.created_at,
               s.username as sender_username, s.id as sender_id,
               r.username as receiver_username, r.id as receiver_id
             FROM messages m
             LEFT JOIN users s ON m.sender_id = s.id
             LEFT JOIN users r ON m.receiver_id = r.id`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      q += ` WHERE s.username ILIKE $1 OR r.username ILIKE $1 OR m.content ILIKE $1`;
    }
    q += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [result, countRes] = await Promise.all([
      query(q, params),
      query(
        search
          ? `SELECT COUNT(*) FROM messages m LEFT JOIN users s ON m.sender_id = s.id LEFT JOIN users r ON m.receiver_id = r.id WHERE s.username ILIKE $1 OR r.username ILIKE $1 OR m.content ILIKE $1`
          : `SELECT COUNT(*) FROM messages`,
        search ? [`%${search}%`] : []
      ),
    ]);

    res.json({ messages: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error('Admin messages error:', err);
    res.status(500).json({ error: 'Could not load messages.' });
  }
});

router.delete('/messages/:id', async (req, res) => {
  try {
    await query('DELETE FROM messages WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'message_deleted', 'message', req.params.id);
    res.json({ message: 'Message deleted.' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// ─── SMTP DEBUG ──────────────────────────────────────────────────────────────
router.post('/test-mail', async (req, res) => {
  try {
    const to = req.body.to || req.user.email;
    await testMailConnection(to);
    res.json({ message: `Test email sent to ${to}.` });
  } catch (err) {
    res.status(500).json({ error: err.message, code: err.code || null });
  }
});

// ─── VISITOR LOG ─────────────────────────────────────────────────────────────
router.get('/visitor-log', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const offset = parseInt(req.query.offset) || 0;
    const result = await query(
      `SELECT vl.*, u.username FROM visitor_log vl
       LEFT JOIN users u ON vl.user_id = u.id
       ORDER BY vl.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countRes = await query('SELECT COUNT(*) FROM visitor_log');
    res.json({ entries: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// ─── CLEAR HTTP LOG (visitor_log) ─────────────────────────────────────────────
router.delete('/http-log', async (req, res) => {
  try {
    const result = await query('DELETE FROM visitor_log');
    await auditLog(req.user.id, 'http_log_cleared', null, null, { count: result.rowCount });
    res.json({ message: `HTTP log cleared. ${result.rowCount} entries deleted.`, deleted: result.rowCount });
  } catch (err) {
    console.error('Clear HTTP log error:', err);
    res.status(500).json({ error: 'Could not clear HTTP log.' });
  }
});

// ─── ADMIN SETTINGS: Set own username color ───────────────────────────────────
router.post('/set-color', async (req, res) => {
  try {
    const { color } = req.body;
    if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Invalid color. Must be a valid hex color like #E63946' });
    }
    await query('UPDATE users SET donator_color = $1 WHERE id = $2', [color, req.user.id]);
    await auditLog(req.user.id, 'admin_color_changed', 'user', req.user.id, { color });
    res.json({ ok: true, donator_color: color });
  } catch (err) {
    console.error('Admin set-color error:', err);
    res.status(500).json({ error: 'Could not update color.' });
  }
});

// ─── DONATIONS OVERVIEW ───────────────────────────────────────────────────────
router.get('/donations', async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*, u.username
      FROM donations d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
      LIMIT 200
    `);
    const stats = await query(`
      SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE payment_status IN ('finished','confirmed')) as confirmed_count,
        COALESCE(SUM(price_amount) FILTER (WHERE payment_status IN ('finished','confirmed')), 0) as total_eur
      FROM donations
    `);
    res.json({
      donations: result.rows,
      stats: stats.rows[0],
    });
  } catch (err) {
    console.error('Donations overview error:', err);
    res.status(500).json({ error: 'Could not load donations.' });
  }
});

export { runCleanup };
export default router;

// ─── CLEANUP FUNCTION ────────────────────────────────────────────────────────
async function runCleanup() {
  const stats = {
    visitor_log_deleted: 0,
    audit_log_deleted: 0,
    messages_deleted: 0,
    anomalies_saved: 0,
  };

  try {
    const [vlCount, alCount] = await Promise.all([
      query('SELECT COUNT(*) FROM visitor_log'),
      query('SELECT COUNT(*) FROM audit_log'),
    ]);
    const visitorTotal = parseInt(vlCount.rows[0].count);
    const auditTotal = parseInt(alCount.rows[0].count);

    // ── VISITOR LOG cleanup ───────────────────────────────────────────────
    const VISITOR_MAX = 5000;
    if (visitorTotal > VISITOR_MAX) {
      const cutoffRes = await query(
        `SELECT created_at FROM visitor_log ORDER BY created_at ASC LIMIT 1 OFFSET $1`,
        [VISITOR_MAX]
      );
      if (cutoffRes.rows[0]) {
        const cutoff = cutoffRes.rows[0].created_at;

        const suspiciousIps = await query(
          `SELECT ip,
                  COUNT(*) as hits,
                  COUNT(DISTINCT path) as unique_paths,
                  MIN(created_at) as first_seen,
                  MAX(created_at) as last_seen
           FROM visitor_log
           WHERE created_at < $1
           GROUP BY ip
           HAVING COUNT(*) > 200 OR COUNT(DISTINCT path) > 50`,
          [cutoff]
        );

        for (const row of suspiciousIps.rows) {
          const reason = row.hits > 200
            ? `High request volume: ${row.hits} hits from IP ${row.ip}`
            : `Scraping pattern: ${row.unique_paths} unique paths from IP ${row.ip}`;
          await query(
            `INSERT INTO anomalies (source, data, reason) VALUES ('visitor_log', $1, $2)`,
            [JSON.stringify(row), reason]
          );
          stats.anomalies_saved++;
        }

        const del = await query(
          `DELETE FROM visitor_log WHERE id IN (
             SELECT id FROM visitor_log ORDER BY created_at ASC LIMIT $1
           )`,
          [visitorTotal - VISITOR_MAX]
        );
        stats.visitor_log_deleted = del.rowCount || 0;
      }
    }

    // ── AUDIT LOG cleanup ─────────────────────────────────────────────────
    const AUDIT_MAX = 2000;
    if (auditTotal > AUDIT_MAX) {
      const auditCutoffRes = await query(
        `SELECT created_at FROM audit_log ORDER BY created_at ASC LIMIT 1 OFFSET $1`,
        [AUDIT_MAX]
      );
      if (auditCutoffRes.rows[0]) {
        const cutoff = auditCutoffRes.rows[0].created_at;

        const bulkActions = await query(
          `SELECT action, admin_id, COUNT(*) as count, MIN(created_at) as first_at
           FROM audit_log
           WHERE created_at < $1
             AND action IN ('posts_bulk_deleted','posts_bulk_removed','user_deleted')
           GROUP BY action, admin_id
           HAVING COUNT(*) > 5`,
          [cutoff]
        );

        for (const row of bulkActions.rows) {
          await query(
            `INSERT INTO anomalies (source, data, reason) VALUES ('audit_log', $1, $2)`,
            [JSON.stringify(row), `Bulk action: ${row.count}x ${row.action}`]
          );
          stats.anomalies_saved++;
        }

        const del = await query(
          `DELETE FROM audit_log WHERE id IN (
             SELECT id FROM audit_log ORDER BY created_at ASC LIMIT $1
           )`,
          [auditTotal - AUDIT_MAX]
        );
        stats.audit_log_deleted = del.rowCount || 0;
      }
    }

    // ── MESSAGES cleanup: 7-day rule ──────────────────────────────────────
    const msgDel = await query(
      `DELETE FROM messages WHERE created_at < NOW() - INTERVAL '7 days'`
    );
    stats.messages_deleted = msgDel.rowCount || 0;

    // Log run
    await query(
      `INSERT INTO db_cleanup_log
         (visitor_log_deleted, audit_log_deleted, messages_deleted, anomalies_saved, visitor_log_total, audit_log_total)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [stats.visitor_log_deleted, stats.audit_log_deleted, stats.messages_deleted, stats.anomalies_saved, visitorTotal, auditTotal]
    );

    if (stats.visitor_log_deleted > 0 || stats.audit_log_deleted > 0 || stats.messages_deleted > 0) {
      console.log(`[cleanup] visitor_log: -${stats.visitor_log_deleted}, audit_log: -${stats.audit_log_deleted}, messages: -${stats.messages_deleted}, anomalies saved: ${stats.anomalies_saved}`);
    }

  } catch (err) {
    console.error('[cleanup] Error:', err.message);
  }

  return stats;
}
