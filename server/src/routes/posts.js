import express from 'express';
import slugify from 'slugify';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin, requireModerator, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

function makeSlug(title) {
  return slugify(title, { lower: true, strict: true }) + '-' + Date.now().toString(36);
}

// GET /api/posts
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const category = req.query.category;
    const search = req.query.search;

    let whereClause = "WHERE p.status = 'published'";
    const params = [];

    if (category) {
      params.push(category);
      whereClause += ` AND c.slug = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (p.title ILIKE $${params.length} OR p.content ILIKE $${params.length})`;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT
        p.id, p.title, p.slug, p.summary, p.view_count, p.created_at,
        u.username as author_username, u.id as author_id,
        c.name as category_name, c.slug as category_slug,
        COUNT(DISTINCT cm.id) as comment_count,
        COUNT(DISTINCT pv.user_id) as vote_count
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN comments cm ON cm.post_id = p.id AND cm.is_removed = FALSE
       LEFT JOIN post_votes pv ON pv.post_id = p.id
       ${whereClause}
       GROUP BY p.id, u.username, u.id, c.name, c.slug
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM posts p
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause.split('LIMIT')[0]}`,
      params.slice(0, -2)
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      posts: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ error: 'Failed to load posts.' });
  }
});

// GET /api/posts/:slug
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        p.id, p.title, p.slug, p.content, p.summary, p.view_count,
        p.created_at, p.updated_at, p.status,
        u.username as author_username, u.id as author_id, u.bio as author_bio,
        c.name as category_name, c.slug as category_slug, c.id as category_id,
        COUNT(DISTINCT pv.user_id) as vote_count
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN post_votes pv ON pv.post_id = p.id
       WHERE p.slug = $1 AND p.status = 'published'
       GROUP BY p.id, u.username, u.id, u.bio, c.name, c.slug, c.id`,
      [req.params.slug]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    await query('UPDATE posts SET view_count = view_count + 1 WHERE id = $1', [result.rows[0].id]);

    let userVoted = false;
    if (req.user) {
      const voteResult = await query(
        'SELECT 1 FROM post_votes WHERE user_id = $1 AND post_id = $2',
        [req.user.id, result.rows[0].id]
      );
      userVoted = voteResult.rows.length > 0;
    }

    res.json({ post: { ...result.rows[0], userVoted } });
  } catch (err) {
    console.error('Get post error:', err);
    res.status(500).json({ error: 'Failed to load post.' });
  }
});

// POST /api/posts
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, content, summary, category_id, status = 'published' } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }
    if (title.length > 300) {
      return res.status(400).json({ error: 'Title is too long (max 300 characters).' });
    }

    const slug = makeSlug(title);

    const result = await query(
      `INSERT INTO posts (title, slug, content, summary, author_id, category_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, slug, created_at`,
      [title.trim(), slug, content, summary || null, req.user.id, category_id || null, status]
    );

    res.status(201).json({ post: result.rows[0] });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post.' });
  }
});

// PATCH /api/posts/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const post = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Post not found.' });

    const isOwner = post.rows[0].author_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to edit this post.' });
    }

    const { title, content, summary, category_id, status } = req.body;

    const result = await query(
      `UPDATE posts SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        summary = COALESCE($3, summary),
        category_id = COALESCE($4, category_id),
        status = COALESCE($5, status),
        updated_at = NOW()
       WHERE id = $6
       RETURNING id, title, slug, updated_at`,
      [title, content, summary, category_id, status, req.params.id]
    );

    res.json({ post: result.rows[0] });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ error: 'Failed to update post.' });
  }
});

// DELETE /api/posts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const post = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Post not found.' });

    const isOwner = post.rows[0].author_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to remove this post.' });
    }

    await query("UPDATE posts SET status = 'removed' WHERE id = $1", [req.params.id]);
    res.json({ message: 'Post removed.' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Failed to remove post.' });
  }
});

// POST /api/posts/:id/vote
router.post('/:id/vote', requireAuth, async (req, res) => {
  try {
    const existing = await query(
      'SELECT 1 FROM post_votes WHERE user_id = $1 AND post_id = $2',
      [req.user.id, req.params.id]
    );

    if (existing.rows.length > 0) {
      await query('DELETE FROM post_votes WHERE user_id = $1 AND post_id = $2',
        [req.user.id, req.params.id]);
      return res.json({ voted: false });
    }

    await query('INSERT INTO post_votes (user_id, post_id) VALUES ($1, $2)',
      [req.user.id, req.params.id]);
    res.json({ voted: true });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Failed to register vote.' });
  }
});

export default router;
