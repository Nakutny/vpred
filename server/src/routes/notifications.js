import express from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/notifications  — eigene Notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, type, title, body, link, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const unread = result.rows.filter(n => !n.is_read).length;
    res.json({ notifications: result.rows, unread });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Notifications.' });
  }
});

// PATCH /api/notifications/read-all  — alle als gelesen markieren
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ message: 'Alle als gelesen markiert.' });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Gelesen.' });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Gelöscht.' });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

// Hilfsfunktion zum Erstellen einer Notification (intern)
export async function createNotification(userId, type, title, body, link) {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body || null, link || null]
    );
  } catch (err) {
    console.error('Notification erstellen fehlgeschlagen:', err.message);
  }
}

export default router;
