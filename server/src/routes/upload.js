import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadToR2 } from '../lib/r2.js';
import crypto from 'crypto';

const router = express.Router();

// Lazy-load sharp inside the handler so a missing/broken sharp never crashes the server
async function tryConvertToPng(buffer) {
  try {
    const { default: sharp } = await import('sharp');
    return await sharp(buffer).png({ compressionLevel: 8 }).toBuffer();
  } catch {
    // sharp not installed or conversion failed — return original buffer
    return null;
  }
}

// POST /api/upload/image
// Body: { data: "data:image/png;base64,...", filename?: "photo.png" }
// Returns: { url: "..." }
router.post('/image', requireAuth, async (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data || !data.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid image data.' });
    }

    // Parse base64 data URL
    const matches = data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid image format.' });

    const originalMime = matches[1];
    const base64Data = matches[2];
    let buffer = Buffer.from(base64Data, 'base64');

    // Size limit: 5MB (checked on original before conversion)
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large. Max 5MB.' });
    }

    // Try to convert to PNG — fall back to original if sharp unavailable
    let finalMime = originalMime;
    const converted = await tryConvertToPng(buffer);
    if (converted) {
      buffer = converted;
      finalMime = 'image/png';
    }

    // Build R2 key
    const ext = finalMime === 'image/png' ? 'png' : (finalMime.split('/')[1]?.replace('+xml', '') || 'jpg');
    const uid = crypto.randomBytes(12).toString('hex');
    const baseName = filename
      ? filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60).replace(/\.[^.]+$/, '')
      : `img_${uid}`;
    const key = `images/${uid}_${baseName}.${ext}`;

    await uploadToR2(key, buffer, finalMime);

    const publicBase = process.env.R2_PUBLIC_URL;
    const url = publicBase ? `${publicBase}/${key}` : `/api/images/${key}`;

    res.json({ url });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
});

export default router;
