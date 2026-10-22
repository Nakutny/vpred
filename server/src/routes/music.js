import express from 'express';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ─── GET /api/music — public list of all tracks ───────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, title, artist, description, duration_seconds, created_at
       FROM music_tracks
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    );
    res.json({ tracks: result.rows });
  } catch (err) {
    console.error('Music list error:', err);
    res.status(500).json({ error: 'Could not load tracks.' });
  }
});

// ─── GET /api/music/:id/stream — stream audio ─────────────────────────────────
router.get('/:id/stream', async (req, res) => {
  try {
    const result = await query(
      `SELECT audio_data, mime_type FROM music_tracks
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Track not found.' });

    const { audio_data, mime_type } = result.rows[0];
    // audio_data stored as base64 TEXT
    const buffer = Buffer.from(audio_data, 'base64');

    res.setHeader('Content-Type', mime_type || 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(buffer);
  } catch (err) {
    console.error('Music stream error:', err);
    res.status(500).json({ error: 'Could not stream track.' });
  }
});

// ─── POST /api/music — upload track (admin only) ─────────────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, artist, description, audio_base64, mime_type, duration_seconds } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
    if (!audio_base64) return res.status(400).json({ error: 'Audio data is required.' });

    // Validate base64 size (~20MB limit for base64 = ~15MB MP3)
    const sizeBytes = Math.ceil(audio_base64.length * 0.75);
    if (sizeBytes > 20 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large. Maximum size is 20 MB.' });
    }

    const result = await query(
      `INSERT INTO music_tracks (title, artist, description, audio_data, mime_type, duration_seconds, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, artist, description, duration_seconds, created_at`,
      [
        title.trim(),
        artist?.trim() || null,
        description?.trim() || null,
        audio_base64,
        mime_type || 'audio/mpeg',
        duration_seconds ? Number(duration_seconds) : null,
        req.user.id,
      ]
    );

    res.status(201).json({ track: result.rows[0] });
  } catch (err) {
    console.error('Music upload error:', err);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

// ─── DELETE /api/music/:id — soft-delete track (admin only) ──────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `UPDATE music_tracks SET deleted_at = NOW(), deleted_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Track not found.' });
    res.json({ message: 'Track deleted.' });
  } catch (err) {
    console.error('Music delete error:', err);
    res.status(500).json({ error: 'Could not delete track.' });
  }
});

// ─── GET /api/music/admin/deleted — list soft-deleted tracks (admin) ─────────
router.get('/admin/deleted', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, title, artist, description, duration_seconds, created_at, deleted_at
       FROM music_tracks
       WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`
    );
    res.json({ tracks: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Could not load deleted tracks.' });
  }
});

// ─── DELETE /api/music/admin/deleted — purge all soft-deleted tracks (admin) ──
router.delete('/admin/deleted', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM music_tracks WHERE deleted_at IS NOT NULL RETURNING id`
    );
    res.json({ purged: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'Could not purge deleted tracks.' });
  }
});

export default router;
