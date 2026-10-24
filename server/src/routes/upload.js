import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadToR2 } from '../lib/r2.js';
import crypto from 'crypto';

const router = express.Router();

// POST /api/upload/image
// Body: { data: "data:image/png;base64,...", filename?: "photo.png" }
// Returns: { url: "/api/images/<key>" }
router.post('/image', requireAuth, async (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data || !data.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid image data.' });
    }

    // Parse base64 data URL
    const matches = data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid image format.' });
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Limit: 5MB
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large. Max 5MB.' });
    }

    // Build R2 key
    const ext = mimeType.split('/')[1]?.replace('+xml', '') || 'jpg';
    const uid = crypto.randomBytes(12).toString('hex');
    const safeName = filename
      ? filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
      : `img_${uid}.${ext}`;
    const key = `images/${uid}_${safeName}`;

    await uploadToR2(key, buffer, mimeType);

    // If R2_PUBLIC_URL is configured, return a direct CDN link
    const publicBase = process.env.R2_PUBLIC_URL;
    const url = publicBase ? `${publicBase}/${key}` : `/api/images/${key}`;

    res.json({ url });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
});

export default router;
