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

// GET /api/users/:username — get a single user by username (public)
router.get('/:username', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, avatar_url, bio, created_at, role
       FROM users
       WHERE LOWER(username) = LOWER($1)`,
      [req.params.username]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to load user.' });
  }
});

export default router;
