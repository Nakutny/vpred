// ─── uploadImage helper ───────────────────────────────────────────────────────
// Uploads an image File to /api/upload/image and returns the URL.
// The server converts it to JPEG, resizes (max 1600px) and stores it in R2.
// Usage:
//   const url = await uploadImage(file, token);
// ─────────────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Detect image by file.type, extension, or magic bytes
export async function looksLikeImage(file) {
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'tiff', 'tif', 'svg', 'heic', 'heif'].includes(ext)) return true;
  try {
    const buf = await file.slice(0, 12).arrayBuffer();
    const b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xD8) return true;                            // JPEG
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true; // PNG
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;           // GIF
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return true; // WebP/RIFF
    if (b[0] === 0x42 && b[1] === 0x4D) return true;                            // BMP
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return true; // AVIF/HEIF
  } catch { /* ignore */ }
  return false;
}

// Read File as base64 data URL
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = ev => resolve(ev.target.result);
    r.onerror = () => reject(new Error('Could not read file.'));
    r.readAsDataURL(file);
  });
}

/**
 * Upload an image file to the server (R2 via /api/upload/image).
 * Returns the public URL string.
 * Throws on error.
 */
export async function uploadImage(file) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Not logged in.');

  const dataUrl = await readAsDataURL(file);

  const res = await fetch(`${BASE}/api/upload/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      image_base64: dataUrl,
      filename: file.name,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
  if (!data.url) throw new Error('Server returned no URL.');
  return data.url;
}
