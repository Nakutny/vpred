import express from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/comments?post_id=... - Kommentare eines Posts
router.get('/', async (req, res) => {
  try {
    const { post_id } = req.query;
    if (!post_id) return res.status(400).json({ error: 'post_id erforderlich' });

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

    // Entfernte Kommentare verschleiern
    const comments = result.rows.map(c => ({
      ...c,
      content: c.is_removed ? '[Kommentar wurde entfernt]' : c.content,
    }));

    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Kommentare' });
  }
});

// POST /api/comments - Kommentar erstellen
router.post('/', requireAuth, async (req, res) => {
  try {
    const { content, post_id, parent_id } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Inhalt erforderlich' });
    if (!post_id) return res.status(400).json({ error: 'post_id erforderlich' });
    if (content.length > 5000) return res.status(400).json({ error: 'Kommentar zu lang' });

    // Prüfen ob Post existiert
    const post = await query("SELECT id FROM posts WHERE id = $1 AND status = 'published'", [post_id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Post nicht gefunden' });

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
    res.status(500).json({ error: 'Fehler beim Erstellen des Kommentars' });
  }
});

// DELETE /api/comments/:id - Kommentar entfernen
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const comment = await query('SELECT * FROM comments WHERE id = $1', [req.params.id]);
    if (!comment.rows[0]) return res.status(404).json({ error: 'Kommentar nicht gefunden' });

    const isOwner = comment.rows[0].author_id === req.user.id;
    const isAdmin = ['admin', 'moderator'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Keine Berechtigung' });

    await query('UPDATE comments SET is_removed = TRUE WHERE id = $1', [req.params.id]);
    res.json({ message: 'Kommentar entfernt' });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Fehler beim Entfernen' });
  }
});

export default router;
