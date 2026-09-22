import express from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/comments?post_id=...
router.get('/', async (req, res) => {
  try {
    const { post_id } = req.query;
    if (!post_id) return res.status(400).json({ error: 'post_id is required.' });

    const result = await query(
      `SELECT
        c.id, c.content, c.parent_id, c.is_removed, c.created_at,
        u.username as author_username, u.id as author_id
       FROM comments c
       LEFT JOIN users u ON c.author_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [post_id]
    );

    const comments = result.rows.map(c => ({
      ...c,
      content: c.is_removed ? '[Comment removed]' : c.content,
    }));

    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Failed to load comments.' });
  }
});

// POST /api/comments
router.post('/', requireAuth, async (req, res) => {
  try {
    const { content, post_id, parent_id } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Comment content is required.' });
    if (!post_id) return res.status(400).json({ error: 'post_id is required.' });
    if (content.length > 5000) return res.status(400).json({ error: 'Comment is too long (max 5000 characters).' });

    const post = await query("SELECT id FROM posts WHERE id = $1 AND status = 'published'", [post_id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Post not found.' });

    const result = await query(
      `INSERT INTO comments (content, author_id, post_id, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, parent_id, created_at`,
      [content.trim(), req.user.id, post_id, parent_id || null]
    );

    res.status(201).json({
      comment: {
        ...result.rows[0],
        author_username: req.user.username,
        author_id: req.user.id,
      }
    });
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ error: 'Failed to post comment.' });
  }
});

// DELETE /api/comments/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const comment = await query('SELECT * FROM comments WHERE id = $1', [req.params.id]);
    if (!comment.rows[0]) return res.status(404).json({ error: 'Comment not found.' });

    const isOwner = comment.rows[0].author_id === req.user.id;
    const isAdmin = ['admin', 'moderator'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'You do not have permission to remove this comment.' });

    await query('UPDATE comments SET is_removed = TRUE WHERE id = $1', [req.params.id]);
    res.json({ message: 'Comment removed.' });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Failed to remove comment.' });
  }
});

export default router;
