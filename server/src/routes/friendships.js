import express from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/friendships — list my friends + pending requests
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Friends (accepted)
    const friendsResult = await query(
      `SELECT
        f.id, f.status, f.created_at,
        CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END as friend_id,
        u.username as friend_username, u.avatar_url as friend_avatar, u.bio as friend_bio
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
       ORDER BY u.username ASC`,
      [userId]
    );

    // Incoming pending requests
    const incomingResult = await query(
      `SELECT f.id, f.created_at, u.id as requester_id, u.username as requester_username, u.avatar_url as requester_avatar
       FROM friendships f
       JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );

    // Outgoing pending requests
    const outgoingResult = await query(
      `SELECT f.id, f.created_at, u.id as addressee_id, u.username as addressee_username, u.avatar_url as addressee_avatar
       FROM friendships f
       JOIN users u ON u.id = f.addressee_id
       WHERE f.requester_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json({
      friends: friendsResult.rows,
      incoming: incomingResult.rows,
      outgoing: outgoingResult.rows,
    });
  } catch (err) {
    console.error('Get friendships error:', err);
    res.status(500).json({ error: 'Failed to load friendships.' });
  }
});

// GET /api/friendships/status/:userId — check friendship status with a user
router.get('/status/:userId', requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const other = req.params.userId;

    const result = await query(
      `SELECT id, status, requester_id FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [me, other]
    );

    if (!result.rows[0]) {
      return res.json({ status: 'none' });
    }

    const f = result.rows[0];
    const iRequested = f.requester_id === me;

    res.json({
      status: f.status,
      friendshipId: f.id,
      iRequested,
    });
  } catch (err) {
    console.error('Friendship status error:', err);
    res.status(500).json({ error: 'Failed to check friendship status.' });
  }
});

// POST /api/friendships — send friend request
router.post('/', requireAuth, async (req, res) => {
  try {
    const { addressee_id } = req.body;
    if (!addressee_id) return res.status(400).json({ error: 'addressee_id is required.' });
    if (addressee_id === req.user.id) return res.status(400).json({ error: 'You cannot befriend yourself.' });

    // Check if blocked
    const blockCheck = await query(
      `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [req.user.id, addressee_id]
    );
    if (blockCheck.rows.length > 0) return res.status(403).json({ error: 'Cannot send friend request.' });

    // Check target user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [addressee_id]);
    if (!userCheck.rows[0]) return res.status(404).json({ error: 'User not found.' });

    // Check existing
    const existing = await query(
      `SELECT id, status FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [req.user.id, addressee_id]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Friend request already exists.' });
    }

    const result = await query(
      `INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2) RETURNING id, status, created_at`,
      [req.user.id, addressee_id]
    );

    res.status(201).json({ friendship: result.rows[0] });
  } catch (err) {
    console.error('Send friend request error:', err);
    res.status(500).json({ error: 'Failed to send friend request.' });
  }
});

// PATCH /api/friendships/:id — accept or decline
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted or declined.' });
    }

    const f = await query('SELECT * FROM friendships WHERE id = $1', [req.params.id]);
    if (!f.rows[0]) return res.status(404).json({ error: 'Friend request not found.' });
    if (f.rows[0].addressee_id !== req.user.id) return res.status(403).json({ error: 'Not your request to respond to.' });
    if (f.rows[0].status !== 'pending') return res.status(400).json({ error: 'Request already handled.' });

    await query(
      `UPDATE friendships SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, req.params.id]
    );

    res.json({ message: `Friend request ${status}.` });
  } catch (err) {
    console.error('Respond to friend request error:', err);
    res.status(500).json({ error: 'Failed to update friend request.' });
  }
});

// DELETE /api/friendships/:id — unfriend or cancel request
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const f = await query('SELECT * FROM friendships WHERE id = $1', [req.params.id]);
    if (!f.rows[0]) return res.status(404).json({ error: 'Friendship not found.' });

    const isParty = f.rows[0].requester_id === req.user.id || f.rows[0].addressee_id === req.user.id;
    if (!isParty) return res.status(403).json({ error: 'Not your friendship.' });

    await query('DELETE FROM friendships WHERE id = $1', [req.params.id]);
    res.json({ message: 'Friendship removed.' });
  } catch (err) {
    console.error('Remove friendship error:', err);
    res.status(500).json({ error: 'Failed to remove friendship.' });
  }
});

export default router;
