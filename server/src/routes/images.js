import express from 'express';
import { streamFromR2 } from '../lib/r2.js';

const router = express.Router();

// GET /api/images/:key(*) — stream any image from R2
router.get('/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    if (!key) return res.status(400).json({ error: 'No key provided.' });

    const r2Res = await streamFromR2(key);

    // Detect content type from key extension or R2 response
    const ext = key.split('.').pop()?.toLowerCase();
    const mimeMap = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml',
      avif: 'image/avif',
    };
    const contentType = r2Res.ContentType || mimeMap[ext] || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (r2Res.ContentLength) res.setHeader('Content-Length', r2Res.ContentLength);

    r2Res.Body.pipe(res);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Image not found.' });
    }
    console.error('Image proxy error:', err);
    res.status(500).json({ error: 'Failed to load image.' });
  }
});

export default router;
