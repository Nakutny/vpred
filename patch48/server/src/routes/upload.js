// ─── Image upload route ───────────────────────────────────────────────────────
// POST /api/upload/image
//   Body: { image_base64: "<data URL or raw base64>", filename?: string }
//   Returns: { url: "https://..." }  (public R2 URL or proxy URL)
//
// Pipeline: base64 → Buffer → sharp (resize + JPEG compress) → R2 upload → URL
// Requires: sharp (npm i sharp), R2 env vars
// Limit: 5 MB input, output is auto-compressed JPEG (quality 82, max 1600px wide)
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import sharp from 'sharp';
import { requireAuth } from '../middleware/auth.js';
import { uploadToR2 } from '../lib/r2.js';

const router = express.Router();

// Public R2 URL base — set R2_PUBLIC_URL env var to your bucket's public domain
// e.g. https://pub-xxxx.r2.dev  or a custom domain
// Falls back to streaming via our own /api/images/:key endpoint if not set.
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || null;

function imageUrl(key) {
  if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  // Fallback: serve via our own backend proxy
  return `/api/images/${encodeURIComponent(key)}`;
}

// ─── POST /api/upload/image ────────────────────────────────────────────────
router.post('/image', requireAuth, async (req, res) => {
  try {
    const { image_base64, filename } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'image_base64 is required.' });

    // Strip data URL prefix if present
    const raw = image_base64.replace(/^data:[^;]+;base64,/, '');
    const inputBuffer = Buffer.from(raw, 'base64');

    // Size check on raw input (5 MB)
    if (inputBuffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large. Maximum input size is 5 MB.' });
    }

    // Convert + compress with sharp
    // - max 1600px on longest side (preserves aspect ratio)
    // - JPEG quality 82 → typically 50–200 KB for photos
    const jpegBuffer = await sharp(inputBuffer)
      .rotate()                          // auto-rotate from EXIF
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    // Build a unique R2 key
    const safeName = (filename || 'image')
      .replace(/\.[^.]+$/, '')           // strip extension
      .replace(/[^\w-]/g, '_')
      .slice(0, 40);
    const key = `images/${Date.now()}_${req.user.id}_${safeName}.jpg`;

    await uploadToR2(key, jpegBuffer, 'image/jpeg');

    const url = imageUrl(key);
    res.json({ url, key });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Image upload failed.', detail: err.message });
  }
});

export default router;
