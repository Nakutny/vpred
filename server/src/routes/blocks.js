import express from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/blocks — list my blocked users
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT b.blocked_id, b.created_at, u.username, u.avatar_url
       FROM blocks b
       JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ blocks: result.rows });
  } catch (err) {
    console.error('Get blocks error:', err);
    res.status(500).json({ error: 'Failed to load block list.' });
  }
});

// POST /api/blocks — block a user
router.post('/', requireAuth, async (req, res) => {
  try {
    const { blocked_id } = req.body;
    if (!blocked_id) return res.status(400).json({ error: 'blocked_id is required.' });
    if (blocked_id === req.user.id) return res.status(400).json({ error: 'You cannot block yourself.' });

    const userCheck = await query('SELECT id FROM users WHERE id = $1', [blocked_id]);
    if (!userCheck.rows[0]) return res.status(404).json({ error: 'User not found.' });

    // Insert block (ignore if already exists)
    await query(
      `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, blocked_id]
    );

    // Remove any friendship between them
    await query(
      `DELETE FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [req.user.id, blocked_id]
    );

    res.status(201).json({ message: 'User blocked.' });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to block user.' });
  }
});

// DELETE /api/blocks/:userId — unblock a user
router.delete('/:userId', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [req.user.id, req.params.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Block not found.' });
    res.json({ message: 'User unblocked.' });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Failed to unblock user.' });
  }
});

export default router;
