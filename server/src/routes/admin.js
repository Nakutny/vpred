import express from 'express';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

async function auditLog(adminId, action, targetType, targetId, details = {}) {
  try {
    await query(
      `INSERT INTO audit_log (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, action, targetType || null, targetId ? String(targetId) : null, JSON.stringify(details)]
    );
  } catch (e) { console.error('Audit log Fehler:', e.message); }
}

// ─── STATS ───────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, posts, comments, warnings, reports] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query("SELECT COUNT(*) FROM posts WHERE status = 'published'"),
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
    res.status(500).json({ error: 'Statistiken konnten nicht geladen werden.' });
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
  } catch (err) { res.status(500).json({ error: 'Export fehlgeschlagen.' }); }
});

router.get('/users', async (req, res) => {
  try {
    const search = req.query.search;
    let q = `SELECT id, username, email, role, is_banned, is_verified, created_at,
               (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as post_count,
               (SELECT COUNT(*) FROM user_warnings WHERE user_id = users.id) as warning_count
             FROM users`;
    const params = [];
    if (search) { params.push(`%${search}%`); q += ` WHERE username ILIKE $1 OR email ILIKE $1`; }
    q += ' ORDER BY created_at DESC LIMIT 200';
    const result = await query(q, params);
    res.json({ users: result.rows });
  } catch (err) { res.status(500).json({ error: 'Benutzer konnten nicht geladen werden.' }); }
});

router.get('/users/:id', async (req, res) => {
  try {
    const userResult = await query(
      `SELECT id, username, email, role, is_banned, is_verified, bio, avatar_url, created_at,
              (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as post_count,
              (SELECT COUNT(*) FROM comments WHERE author_id = users.id) as comment_count
       FROM users WHERE id = $1`, [req.params.id]
    );
    if (!userResult.rows[0]) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
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
  } catch (err) { res.status(500).json({ error: 'Benutzerdetails konnten nicht geladen werden.' }); }
});

router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { banned } = req.body;
    if (req.params.id === String(req.user.id)) return res.status(400).json({ error: 'Du kannst dich nicht selbst bannen.' });
    await query('UPDATE users SET is_banned = $1 WHERE id = $2', [banned, req.params.id]);
    await auditLog(req.user.id, banned ? 'user_banned' : 'user_unbanned', 'user', req.params.id);
    res.json({ message: banned ? 'Gebannt.' : 'Ban aufgehoben.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user','moderator','admin'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle.' });
    if (req.params.id === String(req.user.id) && role !== 'admin') return res.status(400).json({ error: 'Du kannst dich nicht selbst degradieren.' });
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
    await auditLog(req.user.id, 'role_changed', 'user', req.params.id, { role });
    res.json({ message: 'Rolle geändert.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.patch('/users/:id/verify', async (req, res) => {
  try {
    const { verified } = req.body;
    await query('UPDATE users SET is_verified = $1 WHERE id = $2', [verified, req.params.id]);
    await auditLog(req.user.id, verified ? 'user_verified' : 'user_unverified', 'user', req.params.id);
    res.json({ message: verified ? 'Verifiziert.' : 'Verifikation entfernt.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === String(req.user.id)) return res.status(400).json({ error: 'Du kannst deinen eigenen Account nicht löschen.' });
    const userRes = await query('SELECT username FROM users WHERE id = $1', [req.params.id]);
    await query(`UPDATE posts SET author_id = NULL WHERE author_id = $1`, [req.params.id]);
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'user_deleted', 'user', req.params.id, { username: userRes.rows[0]?.username });
    res.json({ message: 'Account gelöscht.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.post('/users/:id/warn', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Grund erforderlich.' });
    await query('INSERT INTO user_warnings (user_id, reason, warned_by) VALUES ($1, $2, $3)', [req.params.id, reason.trim(), req.user.id]);
    await auditLog(req.user.id, 'user_warned', 'user', req.params.id, { reason: reason.trim() });
    res.json({ message: 'Verwarnung ausgesprochen.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.delete('/warnings/:id', async (req, res) => {
  try {
    await query('DELETE FROM user_warnings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Verwarnung entfernt.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
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
  } catch (err) { res.status(500).json({ error: 'Export fehlgeschlagen.' }); }
});

router.get('/posts', async (req, res) => {
  try {
    const search = req.query.search;
    let q = `SELECT p.id, p.title, p.slug, p.status, p.type, p.view_count, p.created_at, u.username as author_username
             FROM posts p LEFT JOIN users u ON p.author_id = u.id`;
    const params = [];
    if (search) { params.push(`%${search}%`); q += ` WHERE p.title ILIKE $1 OR u.username ILIKE $1`; }
    q += ' ORDER BY p.created_at DESC LIMIT 200';
    const result = await query(q, params);
    res.json({ posts: result.rows });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.patch('/posts/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['published','removed','draft'].includes(status)) return res.status(400).json({ error: 'Ungültiger Status.' });
    await query('UPDATE posts SET status = $1 WHERE id = $2', [status, req.params.id]);
    await auditLog(req.user.id, 'post_status_changed', 'post', req.params.id, { status });
    res.json({ message: 'Status geändert.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    const postRes = await query('SELECT title FROM posts WHERE id = $1', [req.params.id]);
    await query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'post_deleted', 'post', req.params.id, { title: postRes.rows[0]?.title });
    res.json({ message: 'Post gelöscht.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.post('/posts/bulk', async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Keine IDs.' });
    if (action === 'delete') {
      await query(`DELETE FROM posts WHERE id = ANY($1::uuid[])`, [ids]);
      await auditLog(req.user.id, 'posts_bulk_deleted', null, null, { count: ids.length });
    } else if (action === 'remove') {
      await query(`UPDATE posts SET status = 'removed' WHERE id = ANY($1::uuid[])`, [ids]);
      await auditLog(req.user.id, 'posts_bulk_removed', null, null, { count: ids.length });
    } else if (action === 'publish') {
      await query(`UPDATE posts SET status = 'published' WHERE id = ANY($1::uuid[])`, [ids]);
    } else { return res.status(400).json({ error: 'Unbekannte Aktion.' }); }
    res.json({ message: `${ids.length} Posts verarbeitet.` });
  } catch (err) { res.status(500).json({ error: 'Bulk-Aktion fehlgeschlagen.' }); }
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
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.patch('/comments/:id/remove', async (req, res) => {
  try {
    const { removed } = req.body;
    await query('UPDATE comments SET is_removed = $1 WHERE id = $2', [removed, req.params.id]);
    await auditLog(req.user.id, removed ? 'comment_removed' : 'comment_restored', 'comment', req.params.id);
    res.json({ message: removed ? 'Entfernt.' : 'Wiederhergestellt.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
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
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['resolved','dismissed'].includes(status)) return res.status(400).json({ error: 'Ungültiger Status.' });
    await query(`UPDATE reports SET status = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3`, [status, req.user.id, req.params.id]);
    await auditLog(req.user.id, `report_${status}`, 'report', req.params.id);
    res.json({ message: 'Report aktualisiert.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
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
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

// ─── IP-SPERREN ──────────────────────────────────────────────────────────────
router.get('/ip-bans', async (req, res) => {
  try {
    const result = await query(
      `SELECT ib.id, ib.ip_address, ib.reason, ib.created_at, u.username as banned_by_username
       FROM ip_bans ib LEFT JOIN users u ON ib.banned_by = u.id ORDER BY ib.created_at DESC`
    );
    res.json({ bans: result.rows });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.post('/ip-bans', async (req, res) => {
  try {
    const { ip_address, reason } = req.body;
    if (!ip_address?.trim()) return res.status(400).json({ error: 'IP-Adresse erforderlich.' });
    await query(
      `INSERT INTO ip_bans (ip_address, reason, banned_by) VALUES ($1, $2, $3)
       ON CONFLICT (ip_address) DO UPDATE SET reason = $2`,
      [ip_address.trim(), reason?.trim() || null, req.user.id]
    );
    await auditLog(req.user.id, 'ip_banned', 'ip', ip_address.trim(), { reason });
    res.json({ message: 'IP gesperrt.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

router.delete('/ip-bans/:id', async (req, res) => {
  try {
    await query('DELETE FROM ip_bans WHERE id = $1', [req.params.id]);
    res.json({ message: 'IP-Sperre aufgehoben.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

// ─── DMs LÖSCHEN ─────────────────────────────────────────────────────────────
router.delete('/messages/:id', async (req, res) => {
  try {
    await query('DELETE FROM messages WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'message_deleted', 'message', req.params.id);
    res.json({ message: 'Nachricht gelöscht.' });
  } catch (err) { res.status(500).json({ error: 'Fehler.' }); }
});

export default router;
