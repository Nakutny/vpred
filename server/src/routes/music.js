// ─── Music routes ─────────────────────────────────────────────────────────────
import express from 'express';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { uploadToR2, streamFromR2, deleteFromR2 } from '../lib/r2.js';

const router = express.Router();

function safeFilename(title) {
  return (title || 'track').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
}

// ─── IMPORTANT: named sub-routes MUST come before /:id ───────────────────────

// ─── GET /api/music/admin/deleted — list soft-deleted tracks (admin) ─────────
router.get('/admin/deleted', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, title, description, duration_seconds, created_at, deleted_at
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

// ─── GET /api/music — public list of all tracks ───────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT mt.id, mt.title, mt.description, mt.duration_seconds, mt.created_at,
              mt.cover_url,
              u.username AS uploader_username, u.id AS uploader_id
       FROM music_tracks mt
       LEFT JOIN users u ON u.id = mt.uploaded_by
       WHERE mt.deleted_at IS NULL
       ORDER BY mt.created_at DESC`
    );
    res.json({ tracks: result.rows });
  } catch (err) {
    console.error('Music list error:', err);
    res.status(500).json({ error: 'Could not load tracks.' });
  }
});

// ─── GET /api/music/:id/stream — stream audio from R2 ────────────────────────
// NOTE: Must stay before /:id
router.get('/:id/stream', async (req, res) => {
  try {
    const result = await query(
      `SELECT title, audio_url, audio_data, mime_type
       FROM music_tracks
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Track not found.' });

    const { title, audio_url, audio_data, mime_type } = result.rows[0];

    if (audio_url) {
      const r2Res = await streamFromR2(audio_url);
      res.setHeader('Content-Type', mime_type || 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Disposition', `inline; filename="${safeFilename(title)}.mp3"`);
      if (r2Res.ContentLength) res.setHeader('Content-Length', r2Res.ContentLength);
      r2Res.Body.pipe(res);
    } else if (audio_data) {
      const buffer = Buffer.from(audio_data, 'base64');
      res.setHeader('Content-Type', mime_type || 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Disposition', `inline; filename="${safeFilename(title)}.mp3"`);
      res.end(buffer);
    } else {
      res.status(404).json({ error: 'Audio file not available.' });
    }
  } catch (err) {
    console.error('Music stream error:', err);
    res.status(500).json({ error: 'Could not stream track.', detail: err.message });
  }
});

// ─── GET /api/music/:id/download — force-download from R2 ────────────────────
// Content-Disposition: attachment  →  browser always downloads, never plays inline
// NOTE: Must stay before /:id
router.get('/:id/download', async (req, res) => {
  try {
    const result = await query(
      `SELECT title, audio_url, audio_data, mime_type
       FROM music_tracks
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Track not found.' });

    const { title, audio_url, audio_data, mime_type } = result.rows[0];
    const filename = `${safeFilename(title)}.mp3`;

    if (audio_url) {
      const r2Res = await streamFromR2(audio_url);
      res.setHeader('Content-Type', mime_type || 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      if (r2Res.ContentLength) res.setHeader('Content-Length', r2Res.ContentLength);
      r2Res.Body.pipe(res);
    } else if (audio_data) {
      const buffer = Buffer.from(audio_data, 'base64');
      res.setHeader('Content-Type', mime_type || 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(buffer);
    } else {
      res.status(404).json({ error: 'Audio file not available.' });
    }
  } catch (err) {
    console.error('Music download error:', err);
    res.status(500).json({ error: 'Could not download track.', detail: err.message });
  }
});

// ─── POST /api/music — upload track (any logged-in user) ─────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, audio_base64, mime_type, duration_seconds, cover_url: cover_url_input } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
    if (!audio_base64) return res.status(400).json({ error: 'Audio data is required.' });

    // Validate audio size (~20 MB limit)
    const sizeBytes = Math.ceil(audio_base64.length * 0.75);
    if (sizeBytes > 20 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large. Maximum size is 20 MB.' });
    }

    // Decode base64 → Buffer and upload to R2
    const base64Data = audio_base64.replace(/^data:audio\/\w+;base64,/, '');
    const audioBuffer = Buffer.from(base64Data, 'base64');
    const key = `tracks/${Date.now()}_${safeFilename(title.trim())}.mp3`;
    await uploadToR2(key, audioBuffer, mime_type || 'audio/mpeg');

    // cover_url is now a URL returned by /api/upload/image (R2) — just validate and use it
    let cover_url = null;
    if (cover_url_input) {
      // Accept R2 proxy paths (/api/images/...), R2 public URLs (https://...), and data: URLs as fallback
      const isValid = cover_url_input.startsWith('/api/images/') ||
        cover_url_input.startsWith('https://') ||
        cover_url_input.startsWith('http://') ||
        cover_url_input.startsWith('data:image');
      if (isValid) cover_url = cover_url_input;
    }

    const result = await query(
      `INSERT INTO music_tracks (title, description, audio_url, audio_data, mime_type, duration_seconds, uploaded_by, cover_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, description, duration_seconds, created_at, cover_url`,
      [
        title.trim(),
        description?.trim() || null,
        key,
        '',   // audio_data NOT NULL — R2 key stored in audio_url, this column is unused
        mime_type || 'audio/mpeg',
        duration_seconds ? Number(duration_seconds) : null,
        req.user.id,
        cover_url,
      ]
    );

    res.status(201).json({ track: result.rows[0] });
  } catch (err) {
    console.error('Music upload error:', err);
    res.status(500).json({ error: 'Upload failed.', detail: err.message });
  }
});

// ─── PATCH /api/music/:id — edit title, description, cover (own track or admin) ─
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const trackRes = await query(
      `SELECT id, uploaded_by FROM music_tracks WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!trackRes.rows[0]) return res.status(404).json({ error: 'Track not found.' });

    const isOwner = trackRes.rows[0].uploaded_by === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not your track.' });
    }

    const { title, description } = req.body;
    if (title !== undefined && !title?.trim()) {
      return res.status(400).json({ error: 'Title cannot be empty.' });
    }

    // cover_url: null = clear it, string = set it, missing key = keep existing
    let coverSql = '';
    const params = [
      title?.trim() ?? null,
      description !== undefined ? (description?.trim() || null) : null,
      req.params.id,
    ];

    if ('cover_url' in req.body) {
      const cv = req.body.cover_url;
      const isValid = cv && (
        cv.startsWith('/api/images/') ||
        cv.startsWith('https://') ||
        cv.startsWith('http://') ||
        cv.startsWith('data:image')
      );
      params.splice(2, 0, isValid ? cv : null); // insert as $3, id becomes $4
      coverSql = ', cover_url = $3';
    }

    const idParam = params.length; // last param is always the id
    const result = await query(
      `UPDATE music_tracks SET
        title       = COALESCE($1, title),
        description = $2${coverSql}
       WHERE id = $${idParam} AND deleted_at IS NULL
       RETURNING id, title, description, duration_seconds, created_at, cover_url`,
      params
    );

    res.json({ track: result.rows[0] });
  } catch (err) {
    console.error('Music edit error:', err);
    res.status(500).json({ error: 'Could not update track.', detail: err.message });
  }
});

// ─── DELETE /api/music/:id — soft-delete (own track or admin) ────────────────
// NOTE: Must stay after all /:id/<sub> routes
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';

    const trackRes = await query(
      `SELECT audio_url, uploaded_by FROM music_tracks WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!trackRes.rows[0]) return res.status(404).json({ error: 'Track not found or not authorized.' });

    const { audio_url, uploaded_by } = trackRes.rows[0];
    if (!isAdmin && uploaded_by !== req.user.id) {
      return res.status(403).json({ error: 'Not your track.' });
    }

    await query(
      `UPDATE music_tracks SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    if (audio_url) {
      try { await deleteFromR2(audio_url); } catch (e) {
        console.warn('R2 delete warning (continuing):', e.message);
      }
    }

    res.json({ message: 'Track deleted.' });
  } catch (err) {
    console.error('Music delete error:', err);
    res.status(500).json({ error: 'Could not delete track.', detail: err.message });
  }
});

export default router;
