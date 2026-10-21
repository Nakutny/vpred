import { Router } from 'express';
import { query } from '../db/client.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/music  — list all tracks (public) ──────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [tracksRes, countRes] = await Promise.all([
      query(
        `SELECT
           t.id, t.name, t.description, t.filename, t.file_size,
           t.created_at, t.uploader_id,
           u.username AS uploader_username,
           COALESCE(
             json_agg(
               json_build_object('id', v.id, 'label', v.label, 'filename', v.filename)
               ORDER BY v.created_at ASC
             ) FILTER (WHERE v.id IS NOT NULL),
             '[]'
           ) AS versions
         FROM music_tracks t
         JOIN users u ON u.id = t.uploader_id
         LEFT JOIN music_versions v ON v.track_id = t.id AND v.deleted_at IS NULL
         WHERE t.deleted_at IS NULL
         GROUP BY t.id, u.username
         ORDER BY t.created_at DESC
         LIMIT $1 OFFSET $2`,
        [parseInt(limit), offset]
      ),
      query(`SELECT COUNT(*)::int AS c FROM music_tracks WHERE deleted_at IS NULL`),
    ]);

    res.json({
      tracks: tracksRes.rows,
      total: countRes.rows[0].c,
      page: parseInt(page),
      pages: Math.ceil(countRes.rows[0].c / parseInt(limit)),
    });
  } catch (err) {
    console.error('music GET /', err);
    res.status(500).json({ error: 'Failed to load tracks.' });
  }
});

// ── POST /api/music  — upload a track ───────────────────────────────────────
// Body: { name, description?, fileData (base64), filename, fileSize }
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, fileData, filename, fileSize } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    if (!fileData) return res.status(400).json({ error: 'File data is required.' });
    if (!filename?.toLowerCase().endsWith('.mp3'))
      return res.status(400).json({ error: 'Only MP3 files are allowed.' });
    if (fileSize > 20 * 1024 * 1024)
      return res.status(400).json({ error: 'File too large — max 20 MB.' });

    const result = await query(
      `INSERT INTO music_tracks (name, description, filename, file_data, file_size, uploader_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, filename, file_size, created_at, uploader_id`,
      [name.trim(), description?.trim() || null, filename, fileData, fileSize, req.user.id]
    );

    res.status(201).json({ track: result.rows[0] });
  } catch (err) {
    console.error('music POST /', err);
    res.status(500).json({ error: 'Failed to upload track.' });
  }
});

// ── GET /api/music/:id/file  — stream/download the mp3 ──────────────────────
router.get('/:id/file', async (req, res) => {
  try {
    const result = await query(
      `SELECT filename, file_data FROM music_tracks WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Track not found.' });

    const { filename, file_data } = result.rows[0];
    const buf = Buffer.from(file_data.split(',')[1] || file_data, 'base64');

    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(buf);
  } catch (err) {
    console.error('music GET /:id/file', err);
    res.status(500).json({ error: 'Failed to serve file.' });
  }
});

// ── GET /api/music/:id/version/:vid/file  — stream a version ────────────────
router.get('/:id/version/:vid/file', async (req, res) => {
  try {
    const result = await query(
      `SELECT v.filename, v.file_data FROM music_versions v
       WHERE v.id = $1 AND v.track_id = $2 AND v.deleted_at IS NULL`,
      [req.params.vid, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Version not found.' });

    const { filename, file_data } = result.rows[0];
    const buf = Buffer.from(file_data.split(',')[1] || file_data, 'base64');

    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(buf);
  } catch (err) {
    console.error('music GET version file', err);
    res.status(500).json({ error: 'Failed to serve version file.' });
  }
});

// ── POST /api/music/:id/versions  — add a version ───────────────────────────
router.post('/:id/versions', requireAuth, async (req, res) => {
  try {
    const { label, fileData, filename, fileSize } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Version label is required.' });
    if (!fileData) return res.status(400).json({ error: 'File data is required.' });
    if (!filename?.toLowerCase().endsWith('.mp3'))
      return res.status(400).json({ error: 'Only MP3 files are allowed.' });
    if (fileSize > 20 * 1024 * 1024)
      return res.status(400).json({ error: 'File too large — max 20 MB.' });

    // Only uploader or admin can add versions
    const trackRes = await query(
      `SELECT uploader_id FROM music_tracks WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!trackRes.rows.length) return res.status(404).json({ error: 'Track not found.' });
    if (trackRes.rows[0].uploader_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not allowed.' });

    const result = await query(
      `INSERT INTO music_versions (track_id, label, filename, file_data, file_size, uploader_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, label, filename, file_size, created_at`,
      [req.params.id, label.trim(), filename, fileData, fileSize, req.user.id]
    );

    res.status(201).json({ version: result.rows[0] });
  } catch (err) {
    console.error('music POST versions', err);
    res.status(500).json({ error: 'Failed to add version.' });
  }
});

// ── DELETE /api/music/:id  — soft-delete a track ────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const trackRes = await query(
      `SELECT uploader_id, name FROM music_tracks WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!trackRes.rows.length) return res.status(404).json({ error: 'Track not found.' });
    if (trackRes.rows[0].uploader_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not allowed.' });

    await query(
      `UPDATE music_tracks SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('music DELETE /:id', err);
    res.status(500).json({ error: 'Failed to delete track.' });
  }
});

// ── DELETE /api/music/:id/versions/:vid  — soft-delete a version ────────────
router.delete('/:id/versions/:vid', requireAuth, async (req, res) => {
  try {
    const vRes = await query(
      `SELECT v.uploader_id FROM music_versions v
       JOIN music_tracks t ON t.id = v.track_id
       WHERE v.id = $1 AND v.track_id = $2 AND v.deleted_at IS NULL`,
      [req.params.vid, req.params.id]
    );
    if (!vRes.rows.length) return res.status(404).json({ error: 'Version not found.' });
    if (vRes.rows[0].uploader_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not allowed.' });

    await query(
      `UPDATE music_versions SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [req.user.id, req.params.vid]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('music DELETE version', err);
    res.status(500).json({ error: 'Failed to delete version.' });
  }
});

// ── GET /api/music/admin/deleted  — admin: list deleted tracks ───────────────
router.get('/admin/deleted', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });

    const result = await query(
      `SELECT t.id, t.name, t.description, t.filename, t.file_size,
              t.created_at, t.deleted_at,
              u.username AS uploader_username,
              d.username AS deleted_by_username
       FROM music_tracks t
       JOIN users u ON u.id = t.uploader_id
       LEFT JOIN users d ON d.id = t.deleted_by
       WHERE t.deleted_at IS NOT NULL
       ORDER BY t.deleted_at DESC`
    );

    res.json({ tracks: result.rows });
  } catch (err) {
    console.error('music admin deleted', err);
    res.status(500).json({ error: 'Failed to load deleted tracks.' });
  }
});

// ── DELETE /api/music/admin/deleted  — admin: permanently purge all deleted ──
router.delete('/admin/deleted', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });

    // Purge versions of deleted tracks first, then tracks
    await query(
      `DELETE FROM music_versions WHERE track_id IN (
         SELECT id FROM music_tracks WHERE deleted_at IS NOT NULL
       )`
    );
    const purge = await query(
      `DELETE FROM music_tracks WHERE deleted_at IS NOT NULL RETURNING id`
    );

    res.json({ purged: purge.rowCount });
  } catch (err) {
    console.error('music admin purge', err);
    res.status(500).json({ error: 'Failed to purge.' });
  }
});

export default router;
