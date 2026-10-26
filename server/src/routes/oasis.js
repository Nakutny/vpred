import express from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ── POST /api/oasis/ping ─────────────────────────────────────────────────────
// Called by logged-in users every 30s to mark themselves as present.
router.post('/ping', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await query(
      `INSERT INTO oasis_presence (user_id, last_seen)
       VALUES ($1, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET last_seen = NOW()`,
      [userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[oasis/ping]', err.message);
    res.status(500).json({ error: 'Ping failed.' });
  }
});

// ── GET /api/oasis/presence ───────────────────────────────────────────────────
// Public endpoint — returns usernames active in the last 2 minutes.
router.get('/presence', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.username
       FROM oasis_presence op
       JOIN users u ON u.id = op.user_id
       WHERE op.last_seen > NOW() - INTERVAL '2 minutes'
         AND (u.is_banned = false OR u.ban_expires_at < NOW())
       ORDER BY op.last_seen DESC`,
    );
    const users = result.rows.map(r => r.username);
    res.set('Cache-Control', 'no-store');
    res.json({ users });
  } catch (err) {
    console.error('[oasis/presence]', err.message);
    res.status(500).json({ error: 'Could not load presence.' });
  }
});

export default router;
