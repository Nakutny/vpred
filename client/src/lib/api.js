const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Auth
export const auth = {
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/api/auth/me'),
};

// Posts
export const posts = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/posts${q ? '?' + q : ''}`);
  },
  get: (slug) => request(`/api/posts/${slug}`),
  create: (body) => request('/api/posts', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/posts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id) => request(`/api/posts/${id}`, { method: 'DELETE' }),
  vote: (id) => request(`/api/posts/${id}/vote`, { method: 'POST' }),
};

// Comments
export const comments = {
  list: (postId) => request(`/api/comments?post_id=${postId}`),
  create: (body) => request('/api/comments', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id) => request(`/api/comments/${id}`, { method: 'DELETE' }),
};

// Categories
export const categories = {
  list: () => request('/api/categories'),
  create: (body) => request('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id) => request(`/api/categories/${id}`, { method: 'DELETE' }),
};

// Admin
export const admin = {
  users: () => request('/api/admin/users'),
  banUser: (id) => request(`/api/admin/users/${id}/ban`, { method: 'POST' }),
  unbanUser: (id) => request(`/api/admin/users/${id}/unban`, { method: 'POST' }),
  setRole: (id, role) => request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  pendingPosts: () => request('/api/admin/posts/pending'),
  removePost: (id) => request(`/api/admin/posts/${id}`, { method: 'DELETE' }),
};
