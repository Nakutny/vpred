import express from 'express';
import slugify from 'slugify';
import { query } from '../db/client.js';
import { requireAuth, requireModerator, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

function makeSlug(title) {
  return slugify(title, { lower: true, strict: true }) + '-' + Date.now().toString(36);
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// GET /api/posts
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const category = req.query.category;
    const search = req.query.search;
    const type = req.query.type || 'research';

    // "story" type is now called "text" — accept both for backward compat
    let resolvedType = type;
    if (resolvedType === 'story') resolvedType = 'text';

    let whereClause = "WHERE p.status = 'published' AND p.parent_post_id IS NULL AND p.deleted_at IS NULL";
    const params = [];

    if (resolvedType !== 'all') {
      params.push(resolvedType);
      whereClause += ` AND p.type = $${params.length}`;
    }

    if (category) {
      params.push(category);
      whereClause += ` AND c.slug = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (p.title ILIKE $${params.length} OR p.content ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT
        p.id, p.title, p.slug, p.summary, p.view_count, p.created_at,
        p.type, p.topic, p.images,
        u.username as author_username, u.id as author_id, u.avatar_url as author_avatar,
        u.donator_color as author_donator_color,
        c.name as category_name, c.slug as category_slug,
        COUNT(DISTINCT cm.id) as comment_count,
        COUNT(DISTINCT pv.user_id) as vote_count,
        COUNT(DISTINCT ep.id) as expand_count
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN comments cm ON cm.post_id = p.id AND cm.is_removed = FALSE
       LEFT JOIN post_votes pv ON pv.post_id = p.id
       LEFT JOIN posts ep ON ep.parent_post_id = p.id AND ep.status = 'published' AND ep.deleted_at IS NULL
       ${whereClause}
       GROUP BY p.id, u.username, u.id, u.avatar_url, u.donator_color, c.name, c.slug
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

// GET /api/posts/drafts — own drafts (requires auth)
// MUST be before /:slug to avoid Express matching "drafts" as a slug value
router.get('/drafts', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.title, p.slug, p.summary, p.type, p.created_at, p.updated_at
       FROM posts p
       WHERE p.author_id = $1 AND p.status = 'draft' AND p.deleted_at IS NULL
       ORDER BY p.updated_at DESC`,
      [req.user.id]
    );
    res.json({ drafts: result.rows });
  } catch (err) {
    console.error('Get drafts error:', err);
    res.status(500).json({ error: 'Failed to load drafts.' });
  }
});

// GET /api/posts/draft/:slug — load own draft by slug (requireAuth, no optionalAuth ambiguity)
// MUST be before /:slug
router.get('/draft/:slug', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        p.id, p.title, p.slug, p.content, p.summary, p.view_count,
        p.created_at, p.updated_at, p.status, p.parent_post_id,
        p.type, p.topic, p.images, p.erd_data,
        u.username as author_username, u.id as author_id, u.bio as author_bio, u.avatar_url as author_avatar,
        u.donator_color as author_donator_color,
        c.name as category_name, c.slug as category_slug, c.id as category_id,
        COUNT(DISTINCT pv.user_id) as vote_count,
        pp.title as parent_title, pp.slug as parent_slug
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN post_votes pv ON pv.post_id = p.id
       LEFT JOIN posts pp ON pp.id = p.parent_post_id
       WHERE p.slug = $1 AND p.author_id = $2 AND p.status = 'draft' AND p.deleted_at IS NULL
       GROUP BY p.id, u.username, u.id, u.bio, u.avatar_url, u.donator_color, c.name, c.slug, c.id, pp.title, pp.slug`,
      [req.params.slug, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Draft not found.' });
    }
    res.json({ post: result.rows[0] });
  } catch (err) {
    console.error('Get draft error:', err);
    res.status(500).json({ error: 'Failed to load draft.' });
  }
});

// GET /api/posts/:slug
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        p.id, p.title, p.slug, p.content, p.summary, p.view_count,
        p.created_at, p.updated_at, p.status, p.parent_post_id,
        p.type, p.topic, p.images, p.erd_data,
        u.username as author_username, u.id as author_id, u.bio as author_bio, u.avatar_url as author_avatar,
        u.donator_color as author_donator_color,
        c.name as category_name, c.slug as category_slug, c.id as category_id,
        COUNT(DISTINCT pv.user_id) as vote_count,
        pp.title as parent_title, pp.slug as parent_slug
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN post_votes pv ON pv.post_id = p.id
       LEFT JOIN posts pp ON pp.id = p.parent_post_id
       WHERE p.slug = $1 AND (p.status = 'published' OR (p.status = 'draft' AND p.author_id = $2)) AND p.deleted_at IS NULL
       GROUP BY p.id, u.username, u.id, u.bio, u.avatar_url, u.donator_color, c.name, c.slug, c.id, pp.title, pp.slug`,
      [req.params.slug, req.user?.id || null]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const post = result.rows[0];

    const ip = getClientIp(req);
    try {
      await query(
        `INSERT INTO post_views (post_id, ip_address, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (post_id, ip_address) DO NOTHING`,
        [post.id, ip, req.user?.id || null]
      );
      const inserted = await query(
        'SELECT COUNT(*) FROM post_views WHERE post_id = $1',
        [post.id]
      );
      await query('UPDATE posts SET view_count = $1 WHERE id = $2', [
        parseInt(inserted.rows[0].count),
        post.id,
      ]);
    } catch (viewErr) {
      await query('UPDATE posts SET view_count = view_count + 1 WHERE id = $1', [post.id]);
    }

    const expandResult = await query(
      `SELECT p.id, p.title, p.slug, p.created_at, u.username as author_username
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       WHERE p.parent_post_id = $1 AND p.status = 'published' AND p.deleted_at IS NULL
       ORDER BY p.created_at ASC`,
      [post.id]
    );

    let userVoted = false;
    if (req.user) {
      const voteResult = await query(
        'SELECT 1 FROM post_votes WHERE user_id = $1 AND post_id = $2',
        [req.user.id, post.id]
      );
      userVoted = voteResult.rows.length > 0;
    }

    res.json({ post: { ...post, userVoted, expand_posts: expandResult.rows } });
  } catch (err) {
    console.error('Get post error:', err);
    res.status(500).json({ error: 'Failed to load post.' });
  }
});

// POST /api/posts
router.post('/', requireAuth, async (req, res) => {
  try {
    // Enforce ban: banned users cannot create posts
    const authorCheck = await query(
      'SELECT is_banned, ban_expires_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (authorCheck.rows[0]) {
      const { is_banned, ban_expires_at } = authorCheck.rows[0];
      if (is_banned) {
        const expired = ban_expires_at && new Date(ban_expires_at) <= new Date();
        if (!expired) {
          return res.status(403).json({ error: 'Your account is suspended. You cannot create posts.' });
        }
        await query('UPDATE users SET is_banned = FALSE, ban_expires_at = NULL WHERE id = $1', [req.user.id]);
      }
    }

    const { title, content, summary, category_id, status = 'published', parent_post_id, topic, images, erd_data } = req.body;
    let { type = 'research' } = req.body;

    // Normalize "story" → "text"
    if (type === 'story') type = 'text';

    // Drafts may have empty content; published posts require content
    const isDraft = status === 'draft';
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }
    if (!isDraft && !content?.trim()) {
      return res.status(400).json({ error: 'Content is required.' });
    }
    if (title.length > 300) {
      return res.status(400).json({ error: 'Title is too long (max 300 characters).' });
    }
    if (!['research', 'essay', 'text'].includes(type)) {
      return res.status(400).json({ error: 'Invalid post type.' });
    }
    if (images && (!Array.isArray(images) || images.length > 3)) {
      return res.status(400).json({ error: 'Maximum 3 images allowed.' });
    }

    if (parent_post_id) {
      const parentCheck = await query('SELECT id FROM posts WHERE id = $1 AND status = $2 AND deleted_at IS NULL', [parent_post_id, 'published']);
      if (!parentCheck.rows[0]) {
        return res.status(400).json({ error: 'Parent post not found.' });
      }
    }

    const slug = makeSlug(title);
    const imagesJson = images ? JSON.stringify(images) : '[]';
    const erdJson = erd_data ? JSON.stringify(erd_data) : null;

    const result = await query(
      `INSERT INTO posts (title, slug, content, summary, author_id, category_id, status, parent_post_id, type, topic, images, erd_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, title, slug, created_at`,
      [title.trim(), slug, content, summary || null, req.user.id, category_id || null, status, parent_post_id || null, type, topic || null, imagesJson, erdJson]
    );

    res.status(201).json({ post: result.rows[0] });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post.' });
  }
});

// PATCH /api/posts/:id — owner, admin, or moderator can edit
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const post = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Post not found.' });

    const isOwner = post.rows[0].author_id === req.user.id;
    const isMod = ['admin', 'moderator'].includes(req.user.role);
    if (!isOwner && !isMod) {
      return res.status(403).json({ error: 'You do not have permission to edit this post.' });
    }

    const { title, content, summary, category_id, status, topic, images, erd_data } = req.body;
    const imagesJson = images ? JSON.stringify(images) : undefined;
    const hasErd = Object.prototype.hasOwnProperty.call(req.body, 'erd_data');
    const erdJson = hasErd ? (erd_data ? JSON.stringify(erd_data) : null) : undefined;

    const setClauses = [
      'title = COALESCE($1, title)',
      'content = COALESCE($2, content)',
      'summary = COALESCE($3, summary)',
      'category_id = COALESCE($4, category_id)',
      'status = COALESCE($5, status)',
      'topic = COALESCE($6, topic)',
      'images = COALESCE($7, images)',
      'updated_at = NOW()',
    ];
    const params = [title, content, summary, category_id, status, topic, imagesJson, req.params.id];

    if (hasErd) {
      params.push(erdJson);
      setClauses.splice(setClauses.length - 1, 0, `erd_data = $${params.length}`);
    }

    const result = await query(
      `UPDATE posts SET ${setClauses.join(', ')} WHERE id = $8 RETURNING id, title, slug, updated_at`,
      params
    );

    res.json({ post: result.rows[0] });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ error: 'Failed to update post.' });
  }
});

// DELETE /api/posts/:id — owner, admin, or moderator can soft-delete
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const post = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Post not found.' });

    const isOwner = post.rows[0].author_id === req.user.id;
    const isMod = ['admin', 'moderator'].includes(req.user.role);
    if (!isOwner && !isMod) {
      return res.status(403).json({ error: 'You do not have permission to remove this post.' });
    }

    // Soft-delete: mark as deleted instead of hard-delete
    await query(
      `UPDATE posts SET deleted_at = NOW(), deleted_by = $1, status = 'removed' WHERE id = $2`,
      [req.user.id, req.params.id]
    );
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

// PATCH /api/posts/:id/publish — publish a draft (requires auth + ownership)
router.patch('/:id/publish', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `UPDATE posts SET status = 'published', created_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND author_id = $2 AND status = 'draft'
       RETURNING id, slug`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Draft not found.' });
    }
    res.json({ post: result.rows[0] });
  } catch (err) {
    console.error('Publish draft error:', err);
    res.status(500).json({ error: 'Failed to publish draft.' });
  }
});

export default router;
