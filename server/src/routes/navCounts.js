import express from 'express';
import { query } from '../db/client.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/nav-counts
// Returns counts for all nav items in one parallel batch.
// friends is only included when the caller is authenticated.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || null;

    // All public counts run in parallel
    const [feedRes, essaysRes, textsRes, categoriesRes, usersRes] = await Promise.all([
      query(`SELECT COUNT(*)::int AS c FROM posts WHERE type = 'research' AND status = 'published' AND deleted_at IS NULL`),
      query(`SELECT COUNT(*)::int AS c FROM posts WHERE type = 'essay'    AND status = 'published' AND deleted_at IS NULL`),
      query(`SELECT COUNT(*)::int AS c FROM posts WHERE type = 'text'     AND status = 'published' AND deleted_at IS NULL`),
      query(`SELECT COUNT(*)::int AS c FROM categories`),
      query(`SELECT COUNT(*)::int AS c FROM users WHERE is_banned = false OR ban_expires_at < NOW()`),
    ]);

    const counts = {
      feed:       feedRes.rows[0].c,
      essays:     essaysRes.rows[0].c,
      texts:      textsRes.rows[0].c,
      categories: categoriesRes.rows[0].c,
      users:      usersRes.rows[0].c,
      friends:    null,
    };

    if (userId) {
      const friendsRes = await query(
        `SELECT COUNT(*)::int AS c FROM friendships
         WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'`,
        [userId]
      );
      counts.friends = friendsRes.rows[0].c;
    }

    // Short cache — counts change frequently but a few seconds stale is fine
    res.set('Cache-Control', 'private, max-age=15');
    res.json(counts);
  } catch (err) {
    console.error('[nav-counts]', err.message);
    res.status(500).json({ error: 'Failed to load nav counts.' });
  }
});

export default router;
