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

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code || null;
    err.email = data.email || null;
    throw err;
  }
  return data;
}

// Auth
export const auth = {
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/api/auth/me'),
  verifyEmail: (token) => request(`/api/auth/verify-email?token=${token}`),
  resendVerification: (email) => request('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, newPassword) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
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
  // Users
  users: (search) => request(`/api/admin/users${search ? '?search=' + encodeURIComponent(search) : ''}`),
  userDetail: (id) => request(`/api/admin/users/${id}`),
  banUser: (id, banned, ban_duration_days) => request(`/api/admin/users/${id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned, ban_duration_days }) }),
  setRole: (id, role) => request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  verifyUser: (id, verified) => request(`/api/admin/users/${id}/verify`, { method: 'PATCH', body: JSON.stringify({ verified }) }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  warnUser: (id, reason) => request(`/api/admin/users/${id}/warn`, { method: 'POST', body: JSON.stringify({ reason }) }),
  removeWarning: (warningId) => request(`/api/admin/warnings/${warningId}`, { method: 'DELETE' }),
  exportUsers: () => `${BASE}/api/admin/users/export/csv`,
  // Posts
  posts: (search) => request(`/api/admin/posts${search ? '?search=' + encodeURIComponent(search) : ''}`),
  setPostStatus: (id, status) => request(`/api/admin/posts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deletePost: (id) => request(`/api/admin/posts/${id}`, { method: 'DELETE' }),
  bulkPosts: (ids, action) => request('/api/admin/posts/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) }),
  exportPosts: () => `${BASE}/api/admin/posts/export/csv`,
  // Kommentare
  comments: () => request('/api/admin/comments'),
  removeComment: (id, removed) => request(`/api/admin/comments/${id}/remove`, { method: 'PATCH', body: JSON.stringify({ removed }) }),
  // Reports
  reports: (status = 'open') => request(`/api/admin/reports?status=${status}`),
  resolveReport: (id, status) => request(`/api/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  // Audit-Log
  auditLog: () => request('/api/admin/audit-log'),
  // IP-Sperren
  ipBans: () => request('/api/admin/ip-bans'),
  addIpBan: (ip_address, reason) => request('/api/admin/ip-bans', { method: 'POST', body: JSON.stringify({ ip_address, reason }) }),
  removeIpBan: (id) => request(`/api/admin/ip-bans/${id}`, { method: 'DELETE' }),
  // DMs
  deleteMessage: (id) => request(`/api/admin/messages/${id}`, { method: 'DELETE' }),
  // Visitor-Log (Patch 21)
  visitorLog: (limit = 200, offset = 0) => request(`/api/admin/visitor-log?limit=${limit}&offset=${offset}`),
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

// Reports (Meldungen)
export const reports = {
  submit: (target_type, target_id, reason) =>
    request('/api/reports', { method: 'POST', body: JSON.stringify({ target_type, target_id, reason }) }),
};

// Notifications
export const notifications = {
  list: () => request('/api/notifications'),
  readAll: () => request('/api/notifications/read-all', { method: 'PATCH' }),
  read: (id) => request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  delete: (id) => request(`/api/notifications/${id}`, { method: 'DELETE' }),
};

// Globale Suche
export const search = {
  all: (q) => request(`/api/posts?search=${encodeURIComponent(q)}&type=all`),
};
