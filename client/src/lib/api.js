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
  banUser: (id) => request(`/api/admin/users/${id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: true }) }),
  unbanUser: (id) => request(`/api/admin/users/${id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: false }) }),
  setRole: (id, role) => request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  setColor: (id, color) => request(`/api/admin/users/${id}/color`, { method: 'PATCH', body: JSON.stringify({ color }) }),
  posts: () => request('/api/admin/posts'),
  setPostStatus: (id, status) => request(`/api/admin/posts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// Profile
export const profile = {
  get: (username) => request(`/api/profile/${username}`),
  updateBio: (bio) => request('/api/profile/me/bio', { method: 'PATCH', body: JSON.stringify({ bio }) }),
  changePassword: (body) => request('/api/profile/me/password', { method: 'PATCH', body: JSON.stringify(body) }),
  update: (body) => request('/api/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  updateAvatar: (avatar_url) => request('/api/profile/me/avatar', { method: 'PATCH', body: JSON.stringify({ avatar_url }) }),
};

// Donate
export const donate = {
  currencies: () => request('/api/donate/currencies'),
  createPayment: (body) => request('/api/donate/create-payment', { method: 'POST', body: JSON.stringify(body) }),
  status: (paymentId) => request(`/api/donate/status/${paymentId}`),
  // color = '#RRGGBB' to set, null to reset to default
  setColor: (color) => request('/api/donate/set-color', { method: 'POST', body: JSON.stringify({ color: color ?? null }) }),
};

// Friendships
export const friendships = {
  list: () => request('/api/friendships'),
  status: (userId) => request(`/api/friendships/status/${userId}`),
  send: (userId) => request('/api/friendships', { method: 'POST', body: JSON.stringify({ addressee_id: userId }) }),
  accept: (id) => request(`/api/friendships/${id}/accept`, { method: 'PATCH' }),
  decline: (id) => request(`/api/friendships/${id}/decline`, { method: 'PATCH' }),
  remove: (id) => request(`/api/friendships/${id}`, { method: 'DELETE' }),
};

// Blocks
export const blocks = {
  list: () => request('/api/blocks'),
  block: (userId) => request('/api/blocks', { method: 'POST', body: JSON.stringify({ blocked_id: userId }) }),
  unblock: (userId) => request(`/api/blocks/${userId}`, { method: 'DELETE' }),
};

// Messages
export const messages = {
  conversations: () => request('/api/messages/conversations'),
  thread: (userId) => request(`/api/messages/${userId}`),
  send: (userId, content) => request(`/api/messages/${userId}`, { method: 'POST', body: JSON.stringify({ content }) }),
};

// Notifications
export const notifications = {
  list: () => request('/api/notifications'),
  markRead: (id) => request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/api/notifications/read-all', { method: 'PATCH' }),
};

// Users
export const users = {
  search: (q) => request(`/api/users/search?q=${encodeURIComponent(q)}`),
  get: (username) => request(`/api/users/${username}`),
};

// Nav counts
export const navCounts = {
  get: () => request('/api/nav-counts'),
};
