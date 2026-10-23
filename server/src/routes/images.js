// ─── Image proxy route ────────────────────────────────────────────────────────
// GET /api/images/:key  — streams an image from R2 to the browser
// This is the fallback when R2_PUBLIC_URL is not configured.
// Once you set R2_PUBLIC_URL in Render env vars, the frontend will use that
// directly and this endpoint is only hit as a legacy fallback.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import { streamFromR2 } from '../lib/r2.js';

const router = express.Router();

router.get('/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    if (!key || key.includes('..')) return res.status(400).json({ error: 'Invalid key.' });

    const r2Res = await streamFromR2(key);
    const ct = r2Res.ContentType || 'image/jpeg';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (r2Res.ContentLength) res.setHeader('Content-Length', r2Res.ContentLength);
    r2Res.Body.pipe(res);
  } catch (err) {
    console.error('Image proxy error:', err.message);
    res.status(404).json({ error: 'Image not found.' });
  }
});

export default router;
