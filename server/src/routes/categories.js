import express from 'express';
import slugify from 'slugify';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.name, c.slug, c.description, c.created_at,
              COUNT(p.id) as post_count
       FROM categories c
       LEFT JOIN posts p ON p.category_id = c.id AND p.status = 'published'
       GROUP BY c.id
       ORDER BY c.name ASC`
    );
    res.json({ categories: result.rows });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to load categories.' });
  }
});

// POST /api/categories - any logged-in user can create
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required.' });
    if (name.length > 80) return res.status(400).json({ error: 'Category name is too long (max 80 characters).' });

    const slug = slugify(name.trim(), { lower: true, strict: true });

    // Check for duplicate
    const existing = await query('SELECT id FROM categories WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A category with this name already exists.' });
    }

    const result = await query(
      `INSERT INTO categories (name, slug, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), slug, description?.trim() || null, req.user.id]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A category with this name already exists.' });
    }
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// DELETE /api/categories/:id - admin only
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Category deleted.' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

export default router;
