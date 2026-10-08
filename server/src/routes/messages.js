import express from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/messages/conversations — list my conversations
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get latest message per conversation
    const result = await query(
      `SELECT DISTINCT ON (other_id)
         other_id,
         other_username,
         other_avatar,
         msg_id,
         content,
         sender_id,
         is_read,
         created_at
       FROM (
         SELECT
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END as other_id,
           u.username as other_username,
           u.avatar_url as other_avatar,
           m.id as msg_id,
           m.content,
           m.sender_id,
           m.is_read,
           m.created_at
         FROM messages m
         JOIN users u ON u.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
         WHERE m.sender_id = $1 OR m.receiver_id = $1
         ORDER BY m.created_at DESC
       ) sub
       ORDER BY other_id, created_at DESC`,
      [userId]
    );

    // Also count unread per conversation
    const unreadResult = await query(
      `SELECT sender_id as other_id, COUNT(*) as unread_count
       FROM messages
       WHERE receiver_id = $1 AND is_read = FALSE
       GROUP BY sender_id`,
      [userId]
    );

    const unreadMap = {};
    for (const row of unreadResult.rows) {
      unreadMap[row.other_id] = parseInt(row.unread_count);
    }

    const conversations = result.rows.map(r => ({
      ...r,
      unread_count: unreadMap[r.other_id] || 0,
    }));

    res.json({ conversations });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Failed to load conversations.' });
  }
});

// GET /api/messages/:userId — get messages with a user
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const other = req.params.userId;

    // Must be friends
    const friendship = await query(
      `SELECT id FROM friendships
       WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
         AND status = 'accepted'`,
      [me, other]
    );
    if (!friendship.rows[0]) {
      return res.status(403).json({ error: 'You can only message friends.' });
    }

    // Check not blocked
    const block = await query(
      `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [me, other]
    );
    if (block.rows.length > 0) {
      return res.status(403).json({ error: 'Cannot message this user.' });
    }

    // Get messages
    const result = await query(
      `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
              u.username as sender_username, u.avatar_url as sender_avatar
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at ASC`,
      [me, other]
    );

    // Mark incoming as read
    await query(
      `UPDATE messages SET is_read = TRUE
       WHERE sender_id = $2 AND receiver_id = $1 AND is_read = FALSE`,
      [me, other]
    );

    res.json({ messages: result.rows });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to load messages.' });
  }
});

// POST /api/messages — send a message
router.post('/', requireAuth, async (req, res) => {
  try {
    const { receiver_id, content } = req.body;
    if (!receiver_id) return res.status(400).json({ error: 'receiver_id is required.' });
    if (!content?.trim()) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (content.trim().length > 2000) return res.status(400).json({ error: 'Message too long (max 2000 chars).' });
    if (receiver_id === req.user.id) return res.status(400).json({ error: 'You cannot message yourself.' });

    // Must be friends
    const friendship = await query(
      `SELECT id FROM friendships
       WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
         AND status = 'accepted'`,
      [req.user.id, receiver_id]
    );
    if (!friendship.rows[0]) {
      return res.status(403).json({ error: 'You can only message friends.' });
    }

    // Check not blocked
    const block = await query(
      `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [req.user.id, receiver_id]
    );
    if (block.rows.length > 0) {
      return res.status(403).json({ error: 'Cannot message this user.' });
    }

    const result = await query(
      `INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)
       RETURNING id, sender_id, receiver_id, content, is_read, created_at`,
      [req.user.id, receiver_id, content.trim()]
    );

    res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// GET /api/messages/unread/count — total unread count
router.get('/unread/count', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM messages WHERE receiver_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count.' });
  }
});

export default router;
