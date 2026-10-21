import { Router } from 'express';
import { query } from '../db/client.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || null;

    const [feedRes, essaysRes, textsRes, categoriesRes, usersRes, musicRes] = await Promise.all([
      query(`SELECT COUNT(*)::int AS c FROM posts WHERE type = 'research' AND status = 'published' AND deleted_at IS NULL`),
      query(`SELECT COUNT(*)::int AS c FROM posts WHERE type = 'essay'    AND status = 'published' AND deleted_at IS NULL`),
      query(`SELECT COUNT(*)::int AS c FROM posts WHERE type = 'text'     AND status = 'published' AND deleted_at IS NULL`),
      query(`SELECT COUNT(*)::int AS c FROM categories`),
      query(`SELECT COUNT(*)::int AS c FROM users WHERE is_banned = false OR ban_expires_at < NOW()`),
      query(`SELECT COUNT(*)::int AS c FROM music_tracks WHERE deleted_at IS NULL`),
    ]);

    const counts = {
      feed:       feedRes.rows[0].c,
      essays:     essaysRes.rows[0].c,
      texts:      textsRes.rows[0].c,
      categories: categoriesRes.rows[0].c,
      users:      usersRes.rows[0].c,
      music:      musicRes.rows[0].c,
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

    res.set('Cache-Control', 'private, max-age=15');
    res.json(counts);
  } catch (err) {
    console.error('navCounts GET /', err);
    res.status(500).json({ error: 'Failed to load counts.' });
  }
});

export default router;
