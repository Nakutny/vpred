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
  forgotPassword: (body) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
  verifyEmail: (token) => request(`/api/auth/verify-email?token=${token}`),
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
  vote: (id) => request(`/api/comments/${id}/vote`, { method: 'POST' }),
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
  banUser: (id, body) => request(`/api/admin/users/${id}/ban`, { method: 'PATCH', body: JSON.stringify(body) }),
  unbanUser: (id) => request(`/api/admin/users/${id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: false }) }),
  setRole: (id, role) => request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  posts: () => request('/api/admin/posts'),
  setPostStatus: (id, status) => request(`/api/admin/posts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  maintenance: () => request('/api/admin/maintenance'),
  setMaintenance: (body) => request('/api/admin/maintenance', { method: 'POST', body: JSON.stringify(body) }),
  // Music admin
  deletedMusic: () => request('/api/music/admin/deleted'),
  purgeDeletedMusic: () => request('/api/music/admin/deleted', { method: 'DELETE' }),
};

// Profile
export const profile = {
  get: (username) => request(`/api/profile/${username}`),
  updateBio: (bio) => request('/api/profile/me/bio', { method: 'PATCH', body: JSON.stringify({ bio }) }),
  updateAvatar: (body) => request('/api/profile/me/avatar', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (body) => request('/api/profile/me/password', { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAccount: () => request('/api/profile/me', { method: 'DELETE' }),
};

// Friendships
export const friendships = {
  list: () => request('/api/friendships'),
  send: (addresseeId) => request('/api/friendships', { method: 'POST', body: JSON.stringify({ addressee_id: addresseeId }) }),
  respond: (id, status) => request(`/api/friendships/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove: (id) => request(`/api/friendships/${id}`, { method: 'DELETE' }),
};

// Blocks
export const blocks = {
  list: () => request('/api/blocks'),
  block: (userId) => request(`/api/blocks/${userId}`, { method: 'POST' }),
  unblock: (userId) => request(`/api/blocks/${userId}`, { method: 'DELETE' }),
};

// Messages
export const messages = {
  list: (userId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/messages/${userId}${q ? '?' + q : ''}`);
  },
  send: (userId, body) => request(`/api/messages/${userId}`, { method: 'POST', body: JSON.stringify(body) }),
  unreadCount: () => request('/api/messages/unread-count'),
  conversations: () => request('/api/messages/conversations'),
};

// Notifications
export const notifications = {
  list: () => request('/api/notifications'),
  markRead: (id) => request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/api/notifications/read-all', { method: 'PATCH' }),
  unreadCount: () => request('/api/notifications/unread-count'),
};

// Users
export const users = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/users${q ? '?' + q : ''}`);
  },
  get: (username) => request(`/api/users/${username}`),
};

// Essays
export const essays = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/essays${q ? '?' + q : ''}`);
  },
  get: (slug) => request(`/api/essays/${slug}`),
  create: (body) => request('/api/essays', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/essays/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id) => request(`/api/essays/${id}`, { method: 'DELETE' }),
};

// Stories / Texts
export const stories = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/stories${q ? '?' + q : ''}`);
  },
  get: (slug) => request(`/api/stories/${slug}`),
  create: (body) => request('/api/stories', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/stories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id) => request(`/api/stories/${id}`, { method: 'DELETE' }),
};

// Donate
export const donate = {
  create: (body) => request('/api/donate', { method: 'POST', body: JSON.stringify(body) }),
  list: () => request('/api/donate'),
};

// Mod
export const mod = {
  reports: () => request('/api/mod/reports'),
  resolveReport: (id, body) => request(`/api/mod/reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  bannedUsers: () => request('/api/mod/banned'),
};

// Nav Counts
export const navCounts = {
  get: () => request('/api/nav-counts'),
};

// Music
export const music = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/music${q ? '?' + q : ''}`);
  },
  upload: (body) => request('/api/music', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id) => request(`/api/music/${id}`, { method: 'DELETE' }),
  addVersion: (trackId, body) => request(`/api/music/${trackId}/versions`, { method: 'POST', body: JSON.stringify(body) }),
  deleteVersion: (trackId, versionId) => request(`/api/music/${trackId}/versions/${versionId}`, { method: 'DELETE' }),
};
