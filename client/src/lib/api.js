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
  stats: () => request('/api/admin/stats'),
  users: (search) => request(`/api/admin/users${search ? '?search=' + encodeURIComponent(search) : ''}`),
  userDetail: (id) => request(`/api/admin/users/${id}`),
  banUser: (id, banned) => request(`/api/admin/users/${id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned }) }),
  setRole: (id, role) => request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  warnUser: (id, reason) => request(`/api/admin/users/${id}/warn`, { method: 'POST', body: JSON.stringify({ reason }) }),
  removeWarning: (warningId) => request(`/api/admin/warnings/${warningId}`, { method: 'DELETE' }),
  posts: (search) => request(`/api/admin/posts${search ? '?search=' + encodeURIComponent(search) : ''}`),
  setPostStatus: (id, status) => request(`/api/admin/posts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deletePost: (id) => request(`/api/admin/posts/${id}`, { method: 'DELETE' }),
  comments: () => request('/api/admin/comments'),
  removeComment: (id, removed) => request(`/api/admin/comments/${id}/remove`, { method: 'PATCH', body: JSON.stringify({ removed }) }),
};

// Profile
export const profile = {
  get: (username) => request(`/api/profile/${username}`),
  updateBio: (bio) => request('/api/profile/me/bio', { method: 'PATCH', body: JSON.stringify({ bio }) }),
  changePassword: (body) => request('/api/profile/me/password', { method: 'PATCH', body: JSON.stringify(body) }),
  updateAvatar: (avatar_url) => request('/api/profile/me/avatar', { method: 'PATCH', body: JSON.stringify({ avatar_url }) }),
};

// Legal pages
export const legal = {
  get: (key) => request(`/api/legal/${key}`),
  update: (key, content) => request(`/api/legal/${key}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
};

// Friendships
export const friendships = {
  list: () => request('/api/friendships'),
  status: (userId) => request(`/api/friendships/status/${userId}`),
  send: (addressee_id) => request('/api/friendships', { method: 'POST', body: JSON.stringify({ addressee_id }) }),
  respond: (id, status) => request(`/api/friendships/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove: (id) => request(`/api/friendships/${id}`, { method: 'DELETE' }),
};

// Messages
export const messages = {
  conversations: () => request('/api/messages/conversations'),
  get: (userId) => request(`/api/messages/${userId}`),
  send: (receiver_id, content) => request('/api/messages', { method: 'POST', body: JSON.stringify({ receiver_id, content }) }),
  unreadCount: () => request('/api/messages/unread/count'),
};

// Blocks
export const blocks = {
  list: () => request('/api/blocks'),
  block: (blocked_id) => request('/api/blocks', { method: 'POST', body: JSON.stringify({ blocked_id }) }),
  unblock: (userId) => request(`/api/blocks/${userId}`, { method: 'DELETE' }),
};
