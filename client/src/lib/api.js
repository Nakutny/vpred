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

  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { code: data.code, status: res.status });
  return data;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const auth = {
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/api/auth/me'),
};

// ─── POSTS ────────────────────────────────────────────────────────────────────
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

// ─── COMMENTS ────────────────────────────────────────────────────────────────
export const comments = {
  list: (postId) => request(`/api/comments?post_id=${postId}`),
  create: (body) => request('/api/comments', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id) => request(`/api/comments/${id}`, { method: 'DELETE' }),
};

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
export const categories = {
  list: () => request('/api/categories'),
  create: (body) => request('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id) => request(`/api/categories/${id}`, { method: 'DELETE' }),
};

// ─── ADMIN ────────────────────────────────────────────────────────────────────
export const admin = {
  // Stats
  stats: () => request('/api/admin/stats'),

  // Users
  users: (search = '') => request(`/api/admin/users${search ? '?search=' + encodeURIComponent(search) : ''}`),
  userDetail: (id) => request(`/api/admin/users/${id}`),
  banUser: (id, banned, ban_duration_days) => request(`/api/admin/users/${id}/ban`, {
    method: 'PATCH',
    body: JSON.stringify({ banned, ban_duration_days: ban_duration_days !== undefined ? Number(ban_duration_days) : undefined }),
  }),
  setRole: (id, role) => request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  verifyUser: (id, verified) => request(`/api/admin/users/${id}/verify`, { method: 'PATCH', body: JSON.stringify({ verified }) }),
  warnUser: (id, reason) => request(`/api/admin/users/${id}/warn`, { method: 'POST', body: JSON.stringify({ reason }) }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  deleteWarning: (id) => request(`/api/admin/warnings/${id}`, { method: 'DELETE' }),
  exportUsersCSV: () => `${BASE}/api/admin/users/export/csv`,

  // Posts
  posts: (search = '') => request(`/api/admin/posts${search ? '?search=' + encodeURIComponent(search) : ''}`),
  deletedPosts: () => request('/api/admin/posts/deleted'),
  setPostStatus: (id, status) => request(`/api/admin/posts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deletePost: (id) => request(`/api/admin/posts/${id}`, { method: 'DELETE' }),
  restorePost: (id) => request(`/api/admin/posts/${id}/restore`, { method: 'PATCH' }),
  permanentDeletePost: (id) => request(`/api/admin/posts/${id}/permanent`, { method: 'DELETE' }),
  bulkPosts: (ids, action) => request('/api/admin/posts/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) }),

  // Comments
  comments: () => request('/api/admin/comments'),
  removeComment: (id, removed) => request(`/api/admin/comments/${id}/remove`, { method: 'PATCH', body: JSON.stringify({ removed }) }),

  // Reports
  reports: (status = 'open') => request(`/api/admin/reports?status=${status}`),
  resolveReport: (id, status) => request(`/api/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Audit log
  auditLog: () => request('/api/admin/audit-log'),

  // DB Status & Cleanup
  dbStatus: () => request('/api/admin/db-status'),
  runCleanup: () => request('/api/admin/db-cleanup', { method: 'POST' }),

  // Anomalies
  anomalies: () => request('/api/admin/anomalies'),
  deleteAnomaly: (id) => request(`/api/admin/anomalies/${id}`, { method: 'DELETE' }),
  clearAnomalies: () => request('/api/admin/anomalies', { method: 'DELETE' }),

  // IP bans
  ipBans: () => request('/api/admin/ip-bans'),
  addIpBan: (ip_address, reason) => request('/api/admin/ip-bans', { method: 'POST', body: JSON.stringify({ ip_address, reason }) }),
  removeIpBan: (id) => request(`/api/admin/ip-bans/${id}`, { method: 'DELETE' }),

  // Messages
  messages: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/admin/messages${q ? '?' + q : ''}`);
  },
  deleteMessage: (id) => request(`/api/admin/messages/${id}`, { method: 'DELETE' }),

  // Visitor log
  visitorLog: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/admin/visitor-log${q ? '?' + q : ''}`);
  },

  // Maintenance mode
  maintenanceStatus: () => request('/api/admin/maintenance'),
  setMaintenance: (enabled, message, estimated_end) => request('/api/admin/maintenance', {
    method: 'PATCH',
    body: JSON.stringify({ enabled, message, estimated_end }),
  }),

  // Test mail
  testMail: (to) => request('/api/admin/test-mail', { method: 'POST', body: JSON.stringify({ to }) }),
};

// ─── PUBLIC MAINTENANCE CHECK ─────────────────────────────────────────────────
export const maintenance = {
  check: () => request('/api/maintenance'),
};
