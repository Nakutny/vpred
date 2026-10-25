import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadToR2 } from '../lib/r2.js';
import crypto from 'crypto';

// sharp is optional — if not installed, images are stored as-is
let sharp;
try {
  const sharpModule = await import('sharp');
  sharp = sharpModule.default;
} catch {
  console.warn('[upload] sharp not available — images stored without conversion');
}

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
    const base64Data = matches[2];
    let buffer = Buffer.from(base64Data, 'base64');

    // Limit before conversion: 5MB
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large. Max 5MB.' });
    }

    // Auto-convert to PNG via sharp (if available)
    let finalMime = 'image/png';
    if (sharp) {
      try {
        buffer = await sharp(buffer).png({ compressionLevel: 8 }).toBuffer();
      } catch (sharpErr) {
        console.warn('[upload] sharp conversion failed, storing original:', sharpErr.message);
        // fall back: store whatever came in
        finalMime = matches[1];
      }
    } else {
      // sharp not available — store as received
      finalMime = matches[1];
    }

    // Build R2 key — always .png when converted
    const ext = finalMime === 'image/png' ? 'png' : (finalMime.split('/')[1]?.replace('+xml', '') || 'jpg');
    const uid = crypto.randomBytes(12).toString('hex');
    const safeName = filename
      ? filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60).replace(/\.[^.]+$/, '') + '.png'
      : `img_${uid}.${ext}`;
    const key = `images/${uid}_${safeName}`;

    await uploadToR2(key, buffer, finalMime);

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
