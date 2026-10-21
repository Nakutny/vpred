import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, categories } from '../lib/api';
import { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDatetime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Flash({ msg, type = 'success' }) {
  if (!msg) return null;
  const color = type === 'error' ? 'var(--danger)' : 'var(--success)';
  return (
    <div style={{ background: color + '18', border: `1px solid ${color}`, borderRadius: 7, padding: '10px 16px', marginBottom: 20, color, fontSize: 14 }}>
      {msg}
    </div>
  );
}

function RoleBadge({ role }) {
  const colors = { admin: '#4f8ef7', moderator: '#4caf7d', user: '#7a8099' };
  return (
    <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: (colors[role] || '#7a8099') + '22', color: colors[role] || '#7a8099' }}>
      {role}
    </span>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 420, width: '90%', padding: 28 }}>
        <p style={{ fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} style={danger ? { background: 'var(--danger)', borderColor: 'var(--danger)' } : {}}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ban Modal ────────────────────────────────────────────────────────────────
function BanModal({ user: targetUser, onClose, onBanned }) {
  const [duration, setDuration] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const durations = [
    { label: '1 day', value: 1 },
    { label: '3 days', value: 3 },
    { label: '7 days', value: 7 },
    { label: '14 days', value: 14 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
    { label: 'Permanent', value: 0 },
  ];

  async function handleBan() {
    if (duration === '') { setErr('Please select a duration.'); return; }
    setLoading(true);
    setErr('');
    try {
      const days = Number(duration);
      await admin.banUser(targetUser.id, true, days, reason.trim() || null);
      onBanned(targetUser.id, true, days);
      onClose();
    } catch (e) { setErr(e.message); setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 400, width: '90%', padding: 28 }}>
        <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.2rem', fontWeight: 400, marginBottom: 6 }}>Ban {targetUser.username}</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Select ban duration:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {durations.map(d => (
            <button key={d.value} onClick={() => setDuration(String(d.value))}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: '1px solid',
                borderColor: duration === String(d.value) ? 'var(--danger)' : 'var(--border)',
                background: duration === String(d.value) ? 'rgba(220,53,69,0.12)' : 'transparent',
                color: duration === String(d.value) ? 'var(--danger)' : 'var(--text)',
                fontWeight: duration === String(d.value) ? 600 : 400,
              }}>{d.label}</button>
          ))}
        </div>
        <textarea
          placeholder="Reason (optional — will be shown to the user)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          maxLength={300}
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--input-bg, #111)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
            fontSize: 13, resize: 'vertical', marginBottom: 16,
            fontFamily: 'inherit',
          }}
        />
        {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleBan} disabled={loading || duration === ''}
            style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
            {loading ? 'Banning...' : 'Ban User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Maintenance Modal ────────────────────────────────────────────────────────
function MaintenanceModal({ current, onClose, onToggle }) {
  const isOn = current?.enabled;
  const [step, setStep] = useState(0); // multi-confirm steps
  const [message, setMessage] = useState(current?.message || 'The platform is temporarily under maintenance. Please check back soon.');
  const [estimatedEnd, setEstimatedEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const confirmSteps = [
    'Are you sure you want to enable maintenance mode? All users (except you) will be locked out.',
    'This will immediately block all non-admin users from accessing the site. Continue?',
    'Final confirmation: Enable maintenance mode now?',
  ];

  async function handleEnable() {
    if (step < 2) { setStep(s => s + 1); return; }
    setLoading(true);
    try {
      await admin.setMaintenance(true, message, estimatedEnd || null);
      onToggle(true);
      onClose();
    } catch (e) { setErr(e.message); setLoading(false); }
  }

  async function handleDisable() {
    setLoading(true);
    try {
      await admin.setMaintenance(false);
      onToggle(false);
      onClose();
    } catch (e) { setErr(e.message); setLoading(false); }
  }

  if (isOn) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 440, width: '90%', padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>🔧</span>
            <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.2rem', fontWeight: 400 }}>Maintenance Active</h3>
          </div>
          <div style={{ background: 'rgba(220,53,69,0.1)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--danger)' }}>
            ⚠️ The site is currently in maintenance mode. All users except admins are locked out.
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="btn btn-primary" onClick={handleDisable} disabled={loading}
              style={{ background: 'var(--success)', borderColor: 'var(--success)' }}>
              {loading ? 'Disabling...' : '✅ Disable Maintenance'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 500, width: '90%', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>🔧</span>
          <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.2rem', fontWeight: 400 }}>Enable Maintenance Mode</h3>
        </div>

        {step === 0 && (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Configure the maintenance window. You will remain logged in and can access everything normally.</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Message for users</label>
              <textarea className="input" style={{ minHeight: 70, resize: 'vertical', fontSize: 13 }}
                value={message} onChange={e => setMessage(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Estimated end time (optional)</label>
              <input type="datetime-local" className="input" value={estimatedEnd} onChange={e => setEstimatedEnd(e.target.value)} />
            </div>
          </>
        )}

        {step > 0 && (
          <div style={{ background: 'rgba(220,53,69,0.1)', borderRadius: 8, padding: '14px 16px', marginBottom: 20, fontSize: 14, color: 'var(--danger)', lineHeight: 1.6 }}>
            ⚠️ {confirmSteps[step]}
          </div>
        )}

        {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEnable} disabled={loading}
            style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
            {loading ? 'Enabling...' : step < 2 ? `Continue (${step + 1}/3)` : '⚠️ Enable Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [loading, setLoading] = useState(false);

  // Users
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [banModal, setBanModal] = useState(null);

  // Categories
  const [categoryList, setCategoryList] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });

  // Posts
  const [postList, setPostList] = useState([]);
  const [postSearch, setPostSearch] = useState('');

  // DB Status
  const [dbStatus, setDbStatus] = useState(null);
  const [dbLoading, setDbLoading] = useState(false);

  // Anomalies
  const [anomalies, setAnomalies] = useState([]);

  // Maintenance
  const [maintenanceData, setMaintenanceData] = useState(null);
  const [maintenanceModal, setMaintenanceModal] = useState(false);

  // Settings (admin color)
  const [adminColor, setAdminColor] = useState(user?.donator_color || '#E63946');
  const [colorSaving, setColorSaving] = useState(false);

  // Donations
  const [donations, setDonations] = useState([]);
  const [donationStats, setDonationStats] = useState(null);

  // HTTP Requests (from db-status)
  const [httpRequests, setHttpRequests] = useState([]);
  const [topIps, setTopIps] = useState([]);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    loadUsers();
    loadCategories();
    loadMaintenanceStatus();
  }, [isAdmin]);

  function flash(m, type = 'success') {
    setMsg(m); setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  }

  // ── Data loaders ────────────────────────────────────────────────────────────
  async function loadUsers() {
    try {
      const d = await admin.users(userSearch);
      setUsers(d.users || []);
    } catch (e) { flash(e.message, 'error'); }
  }

  async function loadCategories() {
    try {
      const d = await categories.list();
      setCategoryList(d.categories || []);
    } catch (e) { flash(e.message, 'error'); }
  }

  async function loadPosts() {
    setLoading(true);
    try {
      const d = await admin.posts(postSearch);
      setPostList(d.posts || []);
    } catch (e) { flash(e.message, 'error'); }
    setLoading(false);
  }

  async function loadDbStatus() {
    setDbLoading(true);
    try {
      const d = await admin.dbStatus();
      setDbStatus(d);
      setHttpRequests(d.recent_requests || []);
      setTopIps(d.top_ips || []);
    } catch (e) { flash(e.message, 'error'); }
    setDbLoading(false);
  }

  async function loadAnomalies() {
    try {
      const d = await admin.anomalies();
      setAnomalies(d.anomalies || []);
    } catch (e) { flash(e.message, 'error'); }
  }

  async function loadMaintenanceStatus() {
    try {
      const d = await admin.maintenanceStatus();
      setMaintenanceData(d.maintenance);
    } catch (e) { /* silent */ }
  }

  useEffect(() => {
    if (tab === 'posts') loadPosts();
    if (tab === 'db') loadDbStatus();
    if (tab === 'anomalies') loadAnomalies();
    if (tab === 'maintenance') loadMaintenanceStatus();
    if (tab === 'donations') loadDonations();
  }, [tab]);

  // ── Users ───────────────────────────────────────────────────────────────────
  async function handleUnban(id) {
    try {
      await admin.banUser(id, false);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_banned: false, ban_expires_at: null } : u));
      flash('User unbanned.');
    } catch (e) { flash(e.message, 'error'); }
  }

  function handleBanned(id, banned, days) {
    setUsers(prev => prev.map(u => {
      if (u.id !== id) return u;
      let ban_expires_at = null;
      if (banned && days > 0) {
        const d = new Date(); d.setDate(d.getDate() + days);
        ban_expires_at = d.toISOString();
      }
      return { ...u, is_banned: banned, ban_expires_at };
    }));
    flash(banned ? 'User banned.' : 'User unbanned.');
  }

  async function handleRole(id, currentRole) {
    const cycle = { user: 'moderator', moderator: 'admin', admin: 'user' };
    const newRole = cycle[currentRole] || 'user';
    try {
      await admin.setRole(id, newRole);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
      flash(`Role updated to ${newRole}.`);
    } catch (e) { flash(e.message, 'error'); }
  }

  async function handleDeleteUser(id, username) {
    if (!confirm(`Permanently delete account "${username}"? This cannot be undone.`)) return;
    try {
      await admin.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      flash('Account deleted.');
    } catch (e) { flash(e.message, 'error'); }
  }

  // ── Categories ──────────────────────────────────────────────────────────────
  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategory.name.trim()) return;
    try {
      const d = await categories.create(newCategory);
      setCategoryList(prev => [...prev, d.category]);
      setNewCategory({ name: '', description: '' });
      flash('Category created.');
    } catch (e) { flash(e.message, 'error'); }
  }

  async function handleDeleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    try {
      await categories.delete(id);
      setCategoryList(prev => prev.filter(c => c.id !== id));
      flash('Category deleted.');
    } catch (e) { flash(e.message, 'error'); }
  }

  // ── Posts ───────────────────────────────────────────────────────────────────
  async function handleDeletePost(id) {
    try {
      await admin.deletePost(id);
      setPostList(prev => prev.filter(p => p.id !== id));
      flash('Post deleted.');
    } catch (e) { flash(e.message, 'error'); }
  }

  // ── DB Cleanup ──────────────────────────────────────────────────────────────
  async function handleCleanup() {
    if (!confirm('Run database cleanup now? This will delete old visitor logs, audit logs, and messages.')) return;
    setDbLoading(true);
    try {
      const d = await admin.runCleanup();
      flash(`Cleanup done. Visitor log: -${d.visitor_log_deleted}, Audit log: -${d.audit_log_deleted}, Messages: -${d.messages_deleted}`);
      await loadDbStatus();
    } catch (e) { flash(e.message, 'error'); }
    setDbLoading(false);
  }

  // ── Anomalies ───────────────────────────────────────────────────────────────
  async function handleDeleteAnomaly(id) {
    try {
      await admin.deleteAnomaly(id);
      setAnomalies(prev => prev.filter(a => a.id !== id));
    } catch (e) { flash(e.message, 'error'); }
  }

  async function handleClearAnomalies() {
    if (!confirm('Delete all anomaly records?')) return;
    try {
      const d = await admin.clearAnomalies();
      setAnomalies([]);
      flash(d.message);
    } catch (e) { flash(e.message, 'error'); }
  }

  // ── HTTP Log ────────────────────────────────────────────────────────────────
  async function handleClearHttpLog() {
    if (!confirm('Clear all HTTP request log entries? This cannot be undone.')) return;
    try {
      const d = await admin.clearHttpLog();
      setHttpRequests([]);
      setTopIps([]);
      flash(d.message);
    } catch (e) { flash(e.message, 'error'); }
  }

  // ── Admin Color ─────────────────────────────────────────────────────────────
  async function handleSaveAdminColor() {
    setColorSaving(true);
    try {
      await admin.setAdminColor(adminColor);
      flash('Username color updated! Reload to see the change everywhere.');
    } catch (e) { flash(e.message, 'error'); }
    setColorSaving(false);
  }

  // ── Donations ───────────────────────────────────────────────────────────────
  async function loadDonations() {
    try {
      const d = await admin.donations();
      setDonations(d.donations || []);
      setDonationStats(d.stats || null);
    } catch (e) { flash(e.message, 'error'); }
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'users', label: 'Users' },
    { id: 'posts', label: 'Posts' },
    { id: 'categories', label: 'Categories' },
    { id: 'donations', label: 'Donations' },
    { id: 'db', label: 'DB Status' },
    { id: 'http', label: 'HTTP Log' },
    { id: 'anomalies', label: 'Anomalies' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  const maintenanceOn = maintenanceData?.enabled;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400 }}>Admin Panel</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Manage users, posts, categories and platform settings.</p>
        </div>
        {maintenanceOn && (
          <div style={{ background: 'rgba(220,53,69,0.12)', border: '1px solid var(--danger)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
            🔧 Maintenance mode is ON
          </div>
        )}
      </div>

      <Flash msg={msg} type={msgType} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 28, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? 'var(--text)' : 'var(--muted)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── USERS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input className="input" placeholder="Search by username or email…" value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadUsers()}
              style={{ maxWidth: 320 }} />
            <button className="btn btn-ghost" onClick={loadUsers}>Search</button>
          </div>
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Username', 'Email', 'Role', 'Status', 'Posts', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{u.username}</span>
                        {u.id === user?.id && <span style={{ fontSize: 11, color: 'var(--muted)' }}>(you)</span>}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>{u.email}</td>
                    <td style={{ padding: '11px 14px' }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: '11px 14px' }}>
                      {u.is_banned ? (
                        <div>
                          <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>Banned</span>
                          {u.ban_expires_at && <div style={{ fontSize: 11, color: 'var(--muted)' }}>until {fmtDate(u.ban_expires_at)}</div>}
                          {!u.ban_expires_at && <div style={{ fontSize: 11, color: 'var(--muted)' }}>permanent</div>}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>Active</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>{u.post_count || 0}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>{fmtDate(u.created_at)}</td>
                    <td style={{ padding: '11px 14px' }}>
                      {u.id !== user?.id && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {u.is_banned ? (
                            <button onClick={() => handleUnban(u.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--success)', fontSize: 11 }}>Unban</button>
                          ) : (
                            <button onClick={() => setBanModal(u)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 11 }}>Ban</button>
                          )}
                          <button onClick={() => handleRole(u.id, u.role)} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                            → {u.role === 'admin' ? 'user' : u.role === 'moderator' ? 'admin' : 'mod'}
                          </button>
                          <button onClick={() => handleDeleteUser(u.id, u.username)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 11 }}>✕</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── POSTS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'posts' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input className="input" placeholder="Search by title or author…" value={postSearch}
              onChange={e => setPostSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadPosts()}
              style={{ maxWidth: 320 }} />
            <button className="btn btn-ghost" onClick={loadPosts}>Search</button>
          </div>
          {loading ? <div style={{ color: 'var(--muted)' }}>Loading…</div> : (
            <div className="card" style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Title', 'Author', 'Type', 'Status', 'Views', 'Date', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {postList.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 14px', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={`/post/${p.slug}`} target="_blank" rel="noopener" style={{ color: 'var(--text)', textDecoration: 'none' }}>{p.title}</a>
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>{p.author_username || '—'}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>{p.type}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12 }}>
                        <span style={{ color: p.status === 'published' ? 'var(--success)' : 'var(--danger)' }}>{p.status}</span>
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>{p.view_count || 0}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>{fmtDate(p.created_at)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <button onClick={() => handleDeletePost(p.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 11 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── CATEGORIES TAB ────────────────────────────────────────────────── */}
      {tab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28 }}>
          <div className="card" style={{ overflow: 'hidden', alignSelf: 'start' }}>
            {categoryList.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No categories yet.</div>
            ) : categoryList.map((c, i) => (
              <div key={c.id} style={{ padding: '14px 20px', borderBottom: i < categoryList.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</div>
                  {c.description && <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{c.description}</div>}
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{c.post_count || 0} posts</div>
                </div>
                <button onClick={() => handleDeleteCategory(c.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>Delete</button>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '20px 22px', alignSelf: 'start' }}>
            <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', fontWeight: 400, marginBottom: 16 }}>Add Category</h3>
            <form onSubmit={handleAddCategory}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Name *</label>
                <input className="input" placeholder="e.g. Politics" value={newCategory.name}
                  onChange={e => setNewCategory(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Description</label>
                <textarea className="input" style={{ minHeight: 70, resize: 'vertical' }} placeholder="Short description…"
                  value={newCategory.description} onChange={e => setNewCategory(p => ({ ...p, description: e.target.value }))} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Create category</button>
            </form>
          </div>
        </div>
      )}

      {/* ── DB STATUS TAB ─────────────────────────────────────────────────── */}
      {tab === 'db' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button className="btn btn-primary" onClick={loadDbStatus} disabled={dbLoading}>
              {dbLoading ? 'Loading…' : '↺ Refresh'}
            </button>
            <button className="btn btn-ghost" onClick={handleCleanup} disabled={dbLoading}
              style={{ color: 'var(--danger)' }}>
              🧹 Run Cleanup Now
            </button>
          </div>

          {dbStatus && (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Visitor Log', value: dbStatus.visitor_log_count?.toLocaleString(), warn: dbStatus.visitor_log_count > 4000 },
                  { label: 'Audit Log', value: dbStatus.audit_log_count?.toLocaleString(), warn: dbStatus.audit_log_count > 1800 },
                  { label: 'Messages', value: dbStatus.messages_count?.toLocaleString() },
                  { label: 'Anomalies', value: dbStatus.anomalies_count?.toLocaleString() },
                  { label: 'DB Size', value: fmt(dbStatus.db_size_bytes) },
                ].map(s => (
                  <div key={s.label} className="card" style={{ padding: '14px 18px', borderColor: s.warn ? 'var(--danger)' : undefined }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.warn ? 'var(--danger)' : 'var(--text)' }}>{s.value ?? '—'}</div>
                  </div>
                ))}
              </div>

              {/* Last cleanup */}
              {dbStatus.last_cleanup && (
                <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>LAST CLEANUP</div>
                  <div style={{ fontSize: 13, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <span>🕐 {fmtDatetime(dbStatus.last_cleanup.ran_at)}</span>
                    <span>Visitor: -{dbStatus.last_cleanup.visitor_log_deleted}</span>
                    <span>Audit: -{dbStatus.last_cleanup.audit_log_deleted}</span>
                    <span>Messages: -{dbStatus.last_cleanup.messages_deleted}</span>
                    <span>Anomalies saved: {dbStatus.last_cleanup.anomalies_saved}</span>
                  </div>
                </div>
              )}

              {/* Table sizes */}
              {dbStatus.table_sizes?.length > 0 && (
                <div className="card" style={{ overflow: 'auto', marginBottom: 20 }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>Table Sizes</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Table', 'Size', 'Est. Rows'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dbStatus.table_sizes.map(t => (
                        <tr key={t.table_name} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '9px 14px', fontSize: 13 }}>{t.table_name}</td>
                          <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--muted)' }}>{fmt(Number(t.size_bytes))}</td>
                          <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--muted)' }}>{Number(t.row_estimate).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {!dbStatus && !dbLoading && (
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>Click "Refresh" to load database status.</div>
          )}
        </div>
      )}

      {/* ── HTTP LOG TAB ─────────────────────────────────────────────────── */}
      {tab === 'http' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button className="btn btn-primary" onClick={loadDbStatus} disabled={dbLoading}>
              {dbLoading ? 'Loading…' : '↺ Refresh'}
            </button>
            <button className="btn btn-ghost" onClick={handleClearHttpLog} style={{ color: 'var(--danger)' }}>
              🗑 Clear HTTP Log
            </button>
          </div>
          {!dbStatus ? (
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>Click "Refresh" to load HTTP request data.</div>
          ) : (
            <>
              {/* Top IPs */}
              {topIps.length > 0 && (
                <div className="card" style={{ overflow: 'auto', marginBottom: 20 }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>Top IP Addresses</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['IP', 'Total Requests', 'Unique Paths', 'First Seen', 'Last Seen'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topIps.map((ip, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '9px 14px', fontSize: 13, fontFamily: 'monospace' }}>{ip.ip}</td>
                          <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: ip.total_requests > 500 ? 700 : 400, color: ip.total_requests > 500 ? 'var(--danger)' : 'var(--text)' }}>
                            {Number(ip.total_requests).toLocaleString()}
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--muted)' }}>{ip.unique_paths}</td>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--muted)' }}>{fmtDatetime(ip.first_seen)}</td>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--muted)' }}>{fmtDatetime(ip.last_seen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recent requests */}
              <div className="card" style={{ overflow: 'auto' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>Recent HTTP Requests (last 100)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Time', 'IP', 'Method', 'Path', 'Status', 'User'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {httpRequests.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 14px', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDatetime(r.created_at)}</td>
                        <td style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'monospace' }}>{r.ip}</td>
                        <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: r.method === 'POST' ? '#4f8ef7' : r.method === 'DELETE' ? 'var(--danger)' : 'var(--text)' }}>
                          {r.method || 'GET'}
                        </td>
                        <td style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'monospace', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.path}</td>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: r.status_code >= 400 ? 'var(--danger)' : r.status_code >= 300 ? '#f7a94f' : 'var(--success)' }}>
                          {r.status_code || '—'}
                        </td>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--muted)' }}>{r.username || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ANOMALIES TAB ─────────────────────────────────────────────────── */}
      {tab === 'anomalies' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button className="btn btn-primary" onClick={loadAnomalies}>↺ Refresh</button>
            {anomalies.length > 0 && (
              <button className="btn btn-ghost" onClick={handleClearAnomalies} style={{ color: 'var(--danger)' }}>
                🗑 Clear all ({anomalies.length})
              </button>
            )}
          </div>

          {anomalies.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              No anomalies recorded.
            </div>
          ) : (
            <div className="card" style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Time', 'Source', 'Reason', 'Data', ''].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDatetime(a.created_at)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--surface2)', fontSize: 11 }}>{a.source}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, maxWidth: 300 }}>{a.reason}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {typeof a.data === 'object' ? JSON.stringify(a.data) : a.data}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => handleDeleteAnomaly(a.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 11 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MAINTENANCE TAB ───────────────────────────────────────────────── */}
      {tab === 'maintenance' && (
        <div style={{ maxWidth: 600 }}>
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 8 }}>🔧 Maintenance Mode</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
              When enabled, all users (except you, as admin) will see a maintenance page and cannot access the platform. You can access everything normally. No data is deleted.
            </p>

            {maintenanceOn ? (
              <div>
                <div style={{ background: 'rgba(220,53,69,0.1)', border: '1px solid var(--danger)', borderRadius: 10, padding: '18px 20px', marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>⚠️ Site is currently in maintenance mode</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    {maintenanceData?.message}<br />
                    {maintenanceData?.estimated_end && <span>Estimated end: {fmtDatetime(maintenanceData.estimated_end)}</span>}
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => setMaintenanceModal(true)}
                  style={{ background: 'var(--success)', borderColor: 'var(--success)', width: '100%', justifyContent: 'center', padding: '14px' }}>
                  ✅ Disable Maintenance Mode
                </button>
              </div>
            ) : (
              <div>
                <div style={{ background: 'rgba(76,175,125,0.1)', border: '1px solid var(--success)', borderRadius: 10, padding: '14px 20px', marginBottom: 20, fontSize: 13, color: 'var(--success)' }}>
                  ✅ Site is running normally — all users have access.
                </div>
                <button className="btn btn-primary" onClick={() => setMaintenanceModal(true)}
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)', width: '100%', justifyContent: 'center', padding: '14px' }}>
                  🔧 Enable Maintenance Mode
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DONATIONS TAB ─────────────────────────────────────────────────── */}
      {tab === 'donations' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button className="btn btn-primary" onClick={loadDonations}>↺ Refresh</button>
          </div>

          {/* Stats */}
          {donationStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total Donations', value: donationStats.total_count },
                { label: 'Confirmed', value: donationStats.confirmed_count },
                { label: 'Total EUR', value: `€${parseFloat(donationStats.total_eur || 0).toFixed(2)}` },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {donations.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No donations yet.</div>
          ) : (
            <div className="card" style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Date', 'User', 'Amount (EUR)', 'Currency', 'Status', 'Payment ID'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {donations.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDatetime(d.created_at)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{d.username || <span style={{ color: 'var(--muted)' }}>Anonymous</span>}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>€{parseFloat(d.price_amount || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)' }}>{d.pay_currency?.toUpperCase() || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: ['finished','confirmed'].includes(d.payment_status) ? 'rgba(76,175,125,0.15)' : 'rgba(100,100,100,0.15)',
                          color: ['finished','confirmed'].includes(d.payment_status) ? 'var(--success)' : 'var(--muted)',
                        }}>
                          {d.payment_status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.payment_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ──────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div style={{ maxWidth: 480 }}>
          <div className="card" style={{ padding: '28px 32px' }}>
            <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 6 }}>
              Username Color
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Your username will appear in this color everywhere on the platform.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <input
                type="color"
                value={adminColor}
                onChange={e => setAdminColor(e.target.value)}
                style={{
                  width: 52, height: 52, border: '2px solid var(--border)',
                  borderRadius: 10, cursor: 'pointer', padding: 3,
                  background: 'var(--surface)',
                }}
              />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: adminColor }}>
                  {user?.username}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, fontFamily: 'monospace' }}>
                  {adminColor}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {['#E63946','#7B2FBE','#1D6FA4','#2D9E6B','#E07B00','#D63384','#0F9A9A','#C9A227','#FF6B6B','#4ECDC4'].map(c => (
                <button key={c} type="button"
                  onClick={() => setAdminColor(c)}
                  title={c}
                  style={{
                    width: 28, height: 28, borderRadius: 6, background: c, border: adminColor === c ? '3px solid var(--text)' : '2px solid transparent',
                    cursor: 'pointer', transition: 'transform 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                />
              ))}
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSaveAdminColor}
              disabled={colorSaving}
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {colorSaving ? 'Saving…' : 'Save Color'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {banModal && (
        <BanModal
          user={banModal}
          onClose={() => setBanModal(null)}
          onBanned={handleBanned}
        />
      )}

      {maintenanceModal && (
        <MaintenanceModal
          current={maintenanceData}
          onClose={() => setMaintenanceModal(false)}
          onToggle={(enabled) => {
            setMaintenanceData(prev => ({ ...prev, enabled }));
            flash(enabled ? '🔧 Maintenance mode enabled.' : '✅ Maintenance mode disabled.');
            loadMaintenanceStatus();
          }}
        />
      )}
    </div>
  );
}
