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
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

// POST /api/categories - nur Admin
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' });

    const slug = slugify(name, { lower: true, strict: true, locale: 'de' });

    const result = await query(
      `INSERT INTO categories (name, slug, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), slug, description || null, req.user.id]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Kategorie existiert bereits' });
    }
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

// DELETE /api/categories/:id - nur Admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Kategorie gelöscht' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

export default router;
