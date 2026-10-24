// Upload a base64 data URL or File to R2 via /api/upload/image
// Returns the URL string (either /api/images/... or https://... CDN)

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function uploadImage(dataUrlOrFile, filename) {
  let data = dataUrlOrFile;

  // If it's a File object, convert to base64 first
  if (dataUrlOrFile instanceof File) {
    data = await readFileAsDataURL(dataUrlOrFile);
    filename = filename || dataUrlOrFile.name;
  }

  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}/api/upload/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data, filename }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Image upload failed.');
  }

  const { url } = await res.json();
  // Prefix relative paths with the API base URL so <img src> works
  if (url.startsWith('/')) return `${BASE}${url}`;
  return url;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}
