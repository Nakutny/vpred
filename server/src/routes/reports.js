import express from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/reports  — Meldung einreichen (jeder eingeloggte User)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { target_type, target_id, reason } = req.body;
    if (!['post', 'comment', 'user'].includes(target_type)) {
      return res.status(400).json({ error: 'Ungültiger Zieltyp.' });
    }
    if (!target_id || !reason?.trim()) {
      return res.status(400).json({ error: 'Ziel und Grund sind erforderlich.' });
    }
    // Doppelmeldungen verhindern
    const exists = await query(
      `SELECT id FROM reports WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'open'`,
      [req.user.id, target_type, target_id]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Du hast diesen Inhalt bereits gemeldet.' });
    }
    await query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4)`,
      [req.user.id, target_type, target_id, reason.trim()]
    );
    res.json({ message: 'Meldung eingereicht.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Einreichen der Meldung.' });
  }
});

export default router;
