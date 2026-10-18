import express from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users — list all users (public, paginated, searchable)
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    const limit = Math.min(parseInt(req.query.limit) || 40, 100);
    const offset = parseInt(req.query.offset) || 0;

    let result;
    if (search) {
      result = await query(
        `SELECT id, username, avatar_url, bio, created_at
         FROM users
         WHERE is_banned = FALSE AND LOWER(username) LIKE LOWER($1)
         ORDER BY username ASC
         LIMIT $2 OFFSET $3`,
        [`%${search}%`, limit, offset]
      );
    } else {
      result = await query(
        `SELECT id, username, avatar_url, bio, created_at
         FROM users
         WHERE is_banned = FALSE
         ORDER BY username ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }

    res.json({ users: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

export default router;
