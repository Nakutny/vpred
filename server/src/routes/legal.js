import express from 'express';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/legal/:key - get a legal page (impressum, privacy, etc.)
router.get('/:key', async (req, res) => {
  try {
    const result = await query(
      'SELECT key, content, updated_at FROM legal_pages WHERE key = $1',
      [req.params.key]
    );

    if (!result.rows[0]) {
      // Return default empty content
      return res.json({
        page: {
          key: req.params.key,
          content: '',
          updated_at: null,
        }
      });
    }

    res.json({ page: result.rows[0] });
  } catch (err) {
    console.error('Get legal page error:', err);
    res.status(500).json({ error: 'Failed to load page.' });
  }
});

// PATCH /api/legal/:key - admin only
router.patch('/:key', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    if (content === undefined) return res.status(400).json({ error: 'Content is required.' });

    const validKeys = ['impressum', 'privacy', 'about'];
    if (!validKeys.includes(req.params.key)) {
      return res.status(400).json({ error: 'Invalid page key.' });
    }

    await query(
      `INSERT INTO legal_pages (key, content, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET content = $2, updated_at = NOW()`,
      [req.params.key, content]
    );

    res.json({ message: 'Page updated.' });
  } catch (err) {
    console.error('Update legal page error:', err);
    res.status(500).json({ error: 'Failed to update page.' });
  }
});

export default router;
