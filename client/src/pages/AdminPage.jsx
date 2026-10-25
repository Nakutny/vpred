import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, categories } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { UsernameWithColor } from '../components/DonatorBadge';

// ── Visitor-category detection based on User-Agent string ──────────────────
// IMPORTANT: Check real browsers FIRST — admins use browsers to call /api/* routes,
// so we must never flag a browser UA as a bot, regardless of the request path.
function detectCategory(log) {
  const ua = (log.user_agent || '').toLowerCase();

  // 1. Real browsers → Person  (check this BEFORE bot keywords)
  if (
    ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') ||
    ua.includes('firefox') || ua.includes('edge') || ua.includes('opera') ||
    ua.includes('opr/')
  ) {
    return { label: '👤 Person', color: '#4caf7d' };
  }

  // 2. Known search engine crawlers
  if (
    ua.includes('googlebot') || ua.includes('bingbot') || ua.includes('yandexbot') ||
    ua.includes('duckduckbot') || ua.includes('baiduspider') || ua.includes('ahrefsbot') ||
    ua.includes('semrushbot') || ua.includes('mj12bot')
  ) {
    return { label: '🔍 Search Engine', color: '#f59e0b' };
  }

  // 3. Social media link-preview bots
  if (
    ua.includes('facebookexternalhit') || ua.includes('twitterbot') ||
    ua.includes('linkedinbot') || ua.includes('whatsapp') || ua.includes('telegram') ||
    ua.includes('slurp') || ua.includes('discordbot') || ua.includes('applebot')
  ) {
    return { label: '📱 Social Preview', color: '#8b5cf6' };
  }

  // 4. Monitoring / uptime services
  if (
    ua.includes('uptimerobot') || ua.includes('pingdom') || ua.includes('statuscake') ||
    ua.includes('newrelic') || ua.includes('datadog') || ua.includes('synthetics')
  ) {
    return { label: '📡 Monitor', color: '#06b6d4' };
  }

  // 5. Generic bots / automation tools / scripted clients
  if (
    ua.includes('bot') || ua.includes('crawler') || ua.includes('spider') ||
    ua.includes('scrapy') || ua.includes('curl') || ua.includes('wget') ||
    ua.includes('python') || ua.includes('java/') || ua.includes('go-http') ||
    ua.includes('libwww') || ua.includes('httpclient') || ua.includes('axios') ||
    ua.includes('node-fetch') || ua.includes('okhttp') || ua.includes('ruby') ||
    ua.includes('php') || ua.includes('perl') || ua.includes('mechanize')
  ) {
    return { label: '🤖 Bot', color: '#e05252' };
  }

  // 6. Truly unknown UA
  return { label: '❓ Unknown', color: '#7a8099' };
}

// ── Country flag from ISO 3166-1 alpha-2 code ──────────────────────────────
function countryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  const code = countryCode.toUpperCase();
  const base = 0x1F1E6 - 65; // 'A'
  return String.fromCodePoint(base + code.charCodeAt(0)) +
         String.fromCodePoint(base + code.charCodeAt(1));
}

// ── Group HTTP logs by IP ───────────────────────────────────────────────────
function groupLogsByIp(logs) {
  const map = new Map();
  for (const log of logs) {
    const ip = log.ip || 'unknown';
    if (!map.has(ip)) {
      map.set(ip, {
        ip,
        country: log.country || null,
        city: log.city || null,
        count: 0,
        paths: [],
        methods: new Set(),
        last_seen: log.created_at,
        first_seen: log.created_at,
        user_agent: log.user_agent || '',
        _firstLog: log,
      });
    }
    const entry = map.get(ip);
    entry.count += 1;
    if (log.path && !entry.paths.includes(log.path)) entry.paths.push(log.path);
    if (log.method) entry.methods.add(log.method);
    if (new Date(log.created_at) > new Date(entry.last_seen)) entry.last_seen = log.created_at;
    if (new Date(log.created_at) < new Date(entry.first_seen)) entry.first_seen = log.created_at;
    if (!entry.user_agent && log.user_agent) entry.user_agent = log.user_agent;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

// ── Default settings structure ─────────────────────────────────────────────
// Used to render controls even when the DB returns empty {}
const SETTING_DEFS = [
  {
    key: 'site_name',
    label: 'Site Name',
    type: 'text',
    placeholder: 'vpred.org',
    description: 'Display name shown in the browser title and footer.',
  },
  {
    key: 'site_tagline',
    label: 'Site Tagline',
    type: 'text',
    placeholder: 'Open Research Collective',
    description: 'Short description shown in the sidebar.',
  },
  {
    key: 'admin_name_color',
    label: 'Admin Name Color',
    type: 'color',
    placeholder: '#4f8ef7',
    description: 'Color used for your username across the platform.',
  },
  {
    key: 'registration_open',
    label: 'Registration Open',
    type: 'toggle',
    description: 'Allow new users to register. Disable to close the platform.',
  },
  {
    key: 'posts_require_approval',
    label: 'Posts Require Approval',
    type: 'toggle',
    description: 'New posts stay hidden until an admin approves them.',
  },
  {
    key: 'max_post_length',
    label: 'Max Post Length (chars)',
    type: 'number',
    placeholder: '50000',
    description: 'Maximum character count allowed per post.',
  },
  {
    key: 'contact_email',
    label: 'Contact Email',
    type: 'text',
    placeholder: 'admin@vpred.org',
    description: 'Email shown on the About / Support pages.',
  },
  {
    key: 'donations_enabled',
    label: 'Donations Enabled',
    type: 'toggle',
    description: 'Show the Donate page and donation features.',
  },
  {
    key: 'music_section_enabled',
    label: 'Music Section Enabled',
    type: 'toggle',
    description: 'Show the Selfmade Music section in the nav.',
  },
];

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');

  const [users, setUsers] = useState([]);
  const [colorEdits, setColorEdits] = useState({});
  const [posts, setPosts] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [donations, setDonations] = useState([]);
  const [dbStatus, setDbStatus] = useState(null);
  const [httpLogs, setHttpLogs] = useState([]);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [logView, setLogView] = useState('grouped');
  const [anomalies, setAnomalies] = useState([]);
  const [clearingAnomalies, setClearingAnomalies] = useState(false);
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '', estimated_end: '' });
  const [maintSaving, setMaintSaving] = useState(false);

  // Settings: use SETTING_DEFS as source-of-truth for UI; DB values fill in values
  const [settings, setSettings] = useState({});
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState('');
  const [msg, setMsg] = useState('');

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3500); }

  const loadTab = useCallback(async (t) => {
    setTabLoading(true);
    setTabError('');
    try {
      if (t === 'users') {
        const d = await admin.users();
        setUsers(d.users || []);
      } else if (t === 'posts') {
        const d = await admin.posts();
        setPosts(d.posts || []);
      } else if (t === 'donations') {
        const d = await admin.donations();
        setDonations(d.donations || []);
      } else if (t === 'db') {
        const d = await admin.dbStatus();
        setDbStatus(d);
      } else if (t === 'logs') {
        const d = await admin.httpLogs();
        setHttpLogs(d.logs || []);
      } else if (t === 'anomalies') {
        const d = await admin.anomalies();
        setAnomalies(d.anomalies || []);
      } else if (t === 'maintenance') {
        const d = await admin.maintenance();
        setMaintenance({
          enabled: d.maintenance || false,
          message: d.message || '',
          estimated_end: d.estimated_end ? d.estimated_end.slice(0, 16) : '',
        });
      } else if (t === 'settings') {
        const d = await admin.settings();
        setSettings(d.settings || {});
      } else if (t === 'categories') {
        const d = await categories.list();
        setCategoryList(d.categories || []);
      }
    } catch (err) {
      setTabError(err.message || 'Failed to load data. Try refreshing.');
    }
    setTabLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    categories.list()
      .then(d => setCategoryList(d.categories || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || loading) return;
    if (tab !== 'categories') {
      loadTab(tab);
    }
  }, [tab, isAdmin, loading]);

  // ── Users ──────────────────────────────────────────────────────────────────
  async function handleBan(id, isBanned) {
    try {
      isBanned ? await admin.unbanUser(id) : await admin.banUser(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_banned: !isBanned } : u));
      flash(isBanned ? 'User unbanned.' : 'User banned.');
    } catch (err) { flash('Error: ' + err.message); }
  }

  async function handleRole(id, role) {
    const newRole = role === 'admin' ? 'user' : role === 'moderator' ? 'admin' : 'moderator';
    try {
      await admin.setRole(id, newRole);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
      flash(`Role updated to ${newRole}.`);
    } catch (err) { flash('Error: ' + err.message); }
  }

  async function handleSetColor(id) {
    const color = colorEdits[id] ?? '';
    try {
      await admin.setColor(id, color || null);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, donator_color: color || null } : u));
      setColorEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
      flash('Color updated.');
    } catch (err) { flash('Error: ' + err.message); }
  }

  async function handleResetColor(id) {
    try {
      await admin.setColor(id, null);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, donator_color: null } : u));
      setColorEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
      flash('Color reset.');
    } catch (err) { flash('Error: ' + err.message); }
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategory.name.trim()) return;
    try {
      const d = await categories.create(newCategory);
      setCategoryList(prev => [...prev, d.category]);
      setNewCategory({ name: '', description: '' });
      flash('Category created.');
    } catch (err) { flash('Error: ' + err.message); }
  }

  async function handleDeleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    try {
      await categories.delete(id);
      setCategoryList(prev => prev.filter(c => c.id !== id));
      flash('Category deleted.');
    } catch (err) { flash('Error: ' + err.message); }
  }

  // ── Posts ──────────────────────────────────────────────────────────────────
  async function handlePostStatus(id, currentStatus) {
    const next = currentStatus === 'published' ? 'removed' : 'published';
    try {
      const result = await admin.setPostStatus(id, next);
      // Use the real status from DB response (not just the optimistic local value)
      const confirmedStatus = result?.post?.status ?? next;
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: confirmedStatus } : p));
      flash('Post status updated.');
    } catch (err) { flash('Error: ' + err.message); }
  }

  // ── HTTP Logs ──────────────────────────────────────────────────────────────
  async function handleClearLogs() {
    if (!confirm('Clear all HTTP logs? This cannot be undone.')) return;
    setClearingLogs(true);
    try {
      await admin.clearHttpLogs();
      setHttpLogs([]);
      flash('HTTP logs cleared.');
    } catch (err) { flash('Error: ' + err.message); }
    setClearingLogs(false);
  }

  // ── Anomalies ──────────────────────────────────────────────────────────────
  async function handleClearAnomalies() {
    if (!confirm('Clear all anomaly logs? This cannot be undone.')) return;
    setClearingAnomalies(true);
    try {
      await admin.clearAnomalies();
      setAnomalies([]);
      flash('Anomalies cleared.');
    } catch (err) { flash('Error: ' + err.message); }
    setClearingAnomalies(false);
  }

  // ── Maintenance ────────────────────────────────────────────────────────────
  async function handleSaveMaintenance() {
    setMaintSaving(true);
    try {
      await admin.setMaintenance(
        maintenance.enabled,
        maintenance.message || null,
        maintenance.estimated_end || null,
      );
      flash(maintenance.enabled ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.');
    } catch (err) { flash('Error: ' + err.message); }
    setMaintSaving(false);
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  function getSettingVal(key, def) {
    if (settings[key] !== undefined) return settings[key];
    return def.placeholder || '';
  }

  function setSettingVal(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function handleSaveSettings() {
    setSettingsSaving(true);
    try {
      await admin.updateSettings(settings);
      flash('Settings saved successfully.');
    } catch (err) { flash('Error: ' + err.message); }
    setSettingsSaving(false);
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────
  function RoleBadge({ role }) {
    const colors = { admin: '#4f8ef7', moderator: '#4caf7d', user: '#7a8099' };
    return (
      <span style={{
        padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
        background: (colors[role] || '#7a8099') + '22', color: colors[role] || '#7a8099',
      }}>
        {role}
      </span>
    );
  }

  function StatusBadge({ status }) {
    const ok = status === 'published';
    return (
      <span style={{
        padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
        background: (ok ? '#4caf7d' : '#e05252') + '22', color: ok ? '#4caf7d' : '#e05252',
      }}>
        {status}
      </span>
    );
  }

  function RefreshBtn({ onClick }) {
    return (
      <button onClick={onClick} style={{
        background: 'none', border: '1px solid var(--border)', borderRadius: 6,
        padding: '4px 10px', cursor: 'pointer', color: 'var(--muted)', fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 5,
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Refresh
      </button>
    );
  }

  function TabHeader({ title, onRefresh, onClear, clearLabel, clearDisabled, extra }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {extra}
          {onClear && (
            <button onClick={onClear} disabled={clearDisabled} style={{
              background: 'rgba(224,82,82,0.12)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 6,
              padding: '4px 10px', cursor: clearDisabled ? 'not-allowed' : 'pointer', color: 'var(--danger)', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 5, opacity: clearDisabled ? 0.6 : 1,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
              </svg>
              {clearDisabled ? 'Clearing…' : (clearLabel || 'Clear All')}
            </button>
          )}
          <RefreshBtn onClick={onRefresh} />
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'users',       label: 'Users' },
    { id: 'posts',       label: 'Posts' },
    { id: 'categories',  label: 'Categories' },
    { id: 'donations',   label: 'Donations' },
    { id: 'db',          label: 'DB Status' },
    { id: 'logs',        label: 'HTTP Log' },
    { id: 'anomalies',   label: 'Anomalies' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'settings',    label: 'Settings' },
  ];

  const th = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const td = { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--muted)' }}>Loading…</div>;

  const groupedLogs = groupLogsByIp(httpLogs);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400 }}>Admin Panel</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Manage users, categories and platform settings.</p>
      </div>

      {msg && (
        <div style={{ background: 'rgba(76,175,125,0.15)', border: '1px solid var(--success)', borderRadius: 7, padding: '10px 16px', marginBottom: 20, color: 'var(--success)', fontSize: 14 }}>
          {msg}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 28, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? 'var(--text)' : 'var(--muted)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tabError && (
        <div style={{
          background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.3)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: 'var(--danger)',
          fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{tabError}</span>
          <button onClick={() => setTabError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {tabLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
      )}

      {!tabLoading && (
        <>
          {/* ── USERS ── */}
          {tab === 'users' && (
            <>
              <TabHeader
                title={users.length > 0 ? `${users.length} user${users.length !== 1 ? 's' : ''}` : 'Users'}
                onRefresh={() => loadTab('users')}
              />
              <div className="card admin-table-wrap" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                  <thead>
                    <tr>
                      {['Username', 'Email', 'Role', 'Status', 'Donator Color', 'Joined', 'Actions'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && !tabLoading && (
                      <tr>
                        <td colSpan={7} style={{ ...td, color: 'var(--muted)', textAlign: 'center', padding: 40 }}>
                          {tabError ? 'Failed to load users.' : 'No users found.'}
                          {' '}
                          <button onClick={() => loadTab('users')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>
                            Try refreshing
                          </button>
                        </td>
                      </tr>
                    )}
                    {users.map(u => {
                      const editColor = colorEdits[u.id] !== undefined ? colorEdits[u.id] : (u.donator_color || '');
                      return (
                        <tr key={u.id}>
                          <td style={td}>
                            <UsernameWithColor user={u} style={{ fontWeight: 600 }} />
                          </td>
                          <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{u.email}</td>
                          <td style={td}><RoleBadge role={u.role} /></td>
                          <td style={td}>
                            {u.is_banned
                              ? <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>Banned</span>
                              : <span style={{ color: 'var(--success)', fontSize: 12 }}>Active</span>}
                          </td>
                          <td style={td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="color"
                                value={editColor || '#4f8ef7'}
                                onChange={e => setColorEdits(prev => ({ ...prev, [u.id]: e.target.value }))}
                                style={{ width: 28, height: 28, padding: 1, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'var(--surface)' }}
                                title="Pick color"
                              />
                              <input
                                type="text"
                                value={editColor}
                                onChange={e => setColorEdits(prev => ({ ...prev, [u.id]: e.target.value }))}
                                placeholder="#RRGGBB"
                                maxLength={7}
                                style={{ width: 80, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 7px', color: 'var(--text)', fontSize: 12, fontFamily: 'monospace' }}
                              />
                              <button onClick={() => handleSetColor(u.id)} style={{ padding: '3px 9px', fontSize: 11, borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                                Set
                              </button>
                              {u.donator_color && (
                                <button onClick={() => handleResetColor(u.id)} title="Reset to default" style={{ padding: '3px 7px', fontSize: 12, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td style={td}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button onClick={() => handleBan(u.id, u.is_banned)} style={{
                                padding: '4px 10px', fontSize: 11, borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 600,
                                background: u.is_banned ? 'rgba(76,175,125,0.15)' : 'rgba(224,82,82,0.15)',
                                color: u.is_banned ? 'var(--success)' : 'var(--danger)',
                              }}>
                                {u.is_banned ? 'Unban' : 'Ban'}
                              </button>
                              <button onClick={() => handleRole(u.id, u.role)} style={{
                                padding: '4px 10px', fontSize: 11, borderRadius: 5, border: '1px solid var(--border)', cursor: 'pointer',
                                background: 'transparent', color: 'var(--muted)',
                              }}>
                                Role ↺
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── POSTS ── */}
          {tab === 'posts' && (
            <>
              <TabHeader
                title={`${posts.length} post${posts.length !== 1 ? 's' : ''}`}
                onRefresh={() => loadTab('posts')}
              />
              <div className="card admin-table-wrap" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr>{['Title', 'Author', 'Status', 'Created', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {posts.length === 0 && (
                      <tr><td colSpan={5} style={{ ...td, color: 'var(--muted)', textAlign: 'center', padding: 32 }}>No posts found.</td></tr>
                    )}
                    {posts.map(p => (
                      <tr key={p.id}>
                        <td style={td}><span style={{ fontWeight: 500 }}>{p.title}</span></td>
                        <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{p.author_username}</td>
                        <td style={td}><StatusBadge status={p.status} /></td>
                        <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{new Date(p.created_at).toLocaleDateString()}</td>
                        <td style={td}>
                          <button onClick={() => handlePostStatus(p.id, p.status)} style={{
                            padding: '4px 10px', fontSize: 11, borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 600,
                            background: p.status === 'published' ? 'rgba(224,82,82,0.15)' : 'rgba(76,175,125,0.15)',
                            color: p.status === 'published' ? 'var(--danger)' : 'var(--success)',
                          }}>
                            {p.status === 'published' ? 'Remove' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── CATEGORIES ── */}
          {tab === 'categories' && (
            <div style={{ display: 'grid', gap: 24 }}>
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Add Category</h3>
                <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <input className="input" style={{ flex: '1 1 200px' }} placeholder="Name" value={newCategory.name} onChange={e => setNewCategory(p => ({ ...p, name: e.target.value }))} />
                  <input className="input" style={{ flex: '2 1 280px' }} placeholder="Description (optional)" value={newCategory.description} onChange={e => setNewCategory(p => ({ ...p, description: e.target.value }))} />
                  <button type="submit" className="btn btn-primary btn-sm">Add</button>
                </form>
              </div>
              <div className="card admin-table-wrap" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Name', 'Description', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {categoryList.map(c => (
                      <tr key={c.id}>
                        <td style={td}><span style={{ fontWeight: 500 }}>{c.name}</span></td>
                        <td style={{ ...td, color: 'var(--muted)' }}>{c.description || '—'}</td>
                        <td style={td}>
                          <button onClick={() => handleDeleteCategory(c.id)} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 600, background: 'rgba(224,82,82,0.15)', color: 'var(--danger)' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DONATIONS ── */}
          {tab === 'donations' && (
            <>
              <TabHeader
                title={`${donations.length} donation${donations.length !== 1 ? 's' : ''}`}
                onRefresh={() => loadTab('donations')}
              />
              <div className="card admin-table-wrap" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead><tr>{['User', 'Amount', 'Currency', 'Status', 'Date'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {donations.length === 0 && (
                      <tr><td colSpan={5} style={{ ...td, color: 'var(--muted)', textAlign: 'center', padding: 32 }}>No donations found.</td></tr>
                    )}
                    {donations.map((d, i) => (
                      <tr key={d.id || i}>
                        <td style={td}>{d.username || d.user_id || '—'}</td>
                        <td style={td}>{d.amount}</td>
                        <td style={{ ...td, color: 'var(--muted)' }}>{d.currency}</td>
                        <td style={td}><StatusBadge status={d.status} /></td>
                        <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── DB STATUS ── */}
          {tab === 'db' && (
            <>
              <TabHeader title="Database Status" onRefresh={() => loadTab('db')} />
              <div className="card" style={{ padding: 28 }}>
                {!dbStatus ? (
                  <p style={{ color: 'var(--muted)' }}>Loading…</p>
                ) : dbStatus.error ? (
                  <p style={{ color: 'var(--danger)' }}>{dbStatus.error}</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                    {Object.entries(dbStatus).map(([key, val]) => (
                      <div key={key} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '14px 18px' }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{key.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{String(val)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── HTTP LOGS ── */}
          {tab === 'logs' && (
            <>
              <TabHeader
                title={logView === 'grouped'
                  ? `${groupedLogs.length} unique IP${groupedLogs.length !== 1 ? 's' : ''} (${httpLogs.length} requests total)`
                  : `${httpLogs.length} request${httpLogs.length !== 1 ? 's' : ''}`
                }
                onRefresh={() => loadTab('logs')}
                onClear={handleClearLogs}
                clearLabel="Clear Logs"
                clearDisabled={clearingLogs || httpLogs.length === 0}
                extra={
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setLogView('grouped')} style={{
                      padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--border)',
                      background: logView === 'grouped' ? 'var(--accent)' : 'transparent',
                      color: logView === 'grouped' ? '#fff' : 'var(--muted)', cursor: 'pointer',
                    }}>Grouped</button>
                    <button onClick={() => setLogView('raw')} style={{
                      padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--border)',
                      background: logView === 'raw' ? 'var(--accent)' : 'transparent',
                      color: logView === 'raw' ? '#fff' : 'var(--muted)', cursor: 'pointer',
                    }}>Raw</button>
                  </div>
                }
              />

              {logView === 'grouped' ? (
                <div className="card admin-table-wrap" style={{ overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                      <tr>
                        {['Flag', 'IP', 'Country / City', 'Requests', 'Paths', 'Category', 'Last Seen'].map(h => (
                          <th key={h} style={th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedLogs.length === 0 && (
                        <tr><td colSpan={7} style={{ ...td, color: 'var(--muted)', textAlign: 'center', padding: 32 }}>No logs found.</td></tr>
                      )}
                      {groupedLogs.map((entry) => {
                        const cat = detectCategory(entry._firstLog);
                        const flag = countryFlag(entry.country);
                        const loc = [entry.city, entry.country].filter(Boolean).join(', ') || '—';
                        const pathList = entry.paths.slice(0, 3).join(', ') + (entry.paths.length > 3 ? ` +${entry.paths.length - 3}` : '');
                        return (
                          <tr key={entry.ip}>
                            <td style={{ ...td, fontSize: 20, lineHeight: 1, width: 40 }}>{flag || '🌐'}</td>
                            <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{entry.ip}</td>
                            <td style={{ ...td, fontSize: 12, color: 'var(--muted)' }}>{loc}</td>
                            <td style={{ ...td, fontWeight: 700, color: 'var(--accent)' }}>{entry.count}</td>
                            <td style={{ ...td, fontSize: 11, color: 'var(--muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.paths.join('\n')}>
                              {pathList || '—'}
                            </td>
                            <td style={td}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: cat.color }}>{cat.label}</span>
                            </td>
                            <td style={{ ...td, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                              {entry.last_seen ? new Date(entry.last_seen).toLocaleString() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="card admin-table-wrap" style={{ overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                      <tr>
                        {['Time', 'Method', 'Path', 'IP', 'Flag', 'Category'].map(h => (
                          <th key={h} style={th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {httpLogs.length === 0 && (
                        <tr><td colSpan={6} style={{ ...td, color: 'var(--muted)', textAlign: 'center', padding: 32 }}>No logs found.</td></tr>
                      )}
                      {httpLogs.map((l, i) => {
                        const cat = detectCategory(l);
                        const flag = countryFlag(l.country);
                        return (
                          <tr key={l.id || i}>
                            <td style={{ ...td, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{l.created_at ? new Date(l.created_at).toLocaleString() : '—'}</td>
                            <td style={{ ...td, fontWeight: 600, fontSize: 12 }}>{l.method}</td>
                            <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.path}</td>
                            <td style={{ ...td, fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{l.ip || '—'}</td>
                            <td style={{ ...td, fontSize: 18, lineHeight: 1 }}>{flag || '🌐'}</td>
                            <td style={td}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: cat.color }}>{cat.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── ANOMALIES ── */}
          {tab === 'anomalies' && (
            <>
              <TabHeader
                title={`${anomalies.length} anomal${anomalies.length !== 1 ? 'ies' : 'y'}`}
                onRefresh={() => loadTab('anomalies')}
                onClear={handleClearAnomalies}
                clearLabel="Clear Anomalies"
                clearDisabled={clearingAnomalies || anomalies.length === 0}
              />
              <div className="card admin-table-wrap" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead><tr>{['Time', 'Type', 'Details', 'IP'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {anomalies.length === 0 && (
                      <tr><td colSpan={4} style={{ ...td, color: 'var(--muted)', textAlign: 'center', padding: 32 }}>No anomalies detected.</td></tr>
                    )}
                    {anomalies.map((a, i) => (
                      <tr key={a.id || i}>
                        <td style={{ ...td, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                        <td style={{ ...td, color: 'var(--danger)', fontWeight: 600, fontSize: 12 }}>{a.type}</td>
                        <td style={{ ...td, fontSize: 12, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.details || '—'}</td>
                        <td style={{ ...td, fontSize: 11, color: 'var(--muted)' }}>{a.ip || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── MAINTENANCE ── */}
          {tab === 'maintenance' && (
            <>
              <TabHeader title="Maintenance Mode" onRefresh={() => loadTab('maintenance')} />
              <div className="card" style={{ padding: 28, maxWidth: 540 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={maintenance.enabled}
                    onChange={e => setMaintenance(m => ({ ...m, enabled: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontWeight: 600 }}>Enable Maintenance Mode</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, display: 'block', marginBottom: 6, color: 'var(--muted)' }}>Message shown to visitors</label>
                    <textarea
                      className="input"
                      value={maintenance.message}
                      onChange={e => setMaintenance(m => ({ ...m, message: e.target.value }))}
                      placeholder="We'll be back shortly…"
                      rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, display: 'block', marginBottom: 6, color: 'var(--muted)' }}>Estimated end (optional)</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={maintenance.estimated_end}
                      onChange={e => setMaintenance(m => ({ ...m, estimated_end: e.target.value }))}
                    />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveMaintenance} disabled={maintSaving} style={{ alignSelf: 'flex-start' }}>
                    {maintSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── SETTINGS ── */}
          {tab === 'settings' && (
            <>
              <TabHeader title="Platform Settings" onRefresh={() => loadTab('settings')} />
              <div style={{ display: 'grid', gap: 20, maxWidth: 620 }}>
                {/* Section: Appearance */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 18, color: 'var(--text)' }}>
                    🎨 Appearance
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {SETTING_DEFS.filter(d => ['site_name', 'site_tagline', 'admin_name_color'].includes(d.key)).map(def => (
                      <SettingRow key={def.key} def={def} val={settings[def.key]} onChange={v => setSettingVal(def.key, v)} />
                    ))}
                  </div>
                </div>

                {/* Section: Access & Registration */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 18, color: 'var(--text)' }}>
                    🔐 Access & Registration
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {SETTING_DEFS.filter(d => ['registration_open', 'posts_require_approval'].includes(d.key)).map(def => (
                      <SettingRow key={def.key} def={def} val={settings[def.key]} onChange={v => setSettingVal(def.key, v)} />
                    ))}
                  </div>
                </div>

                {/* Section: Content */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 18, color: 'var(--text)' }}>
                    📝 Content
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {SETTING_DEFS.filter(d => ['max_post_length', 'contact_email'].includes(d.key)).map(def => (
                      <SettingRow key={def.key} def={def} val={settings[def.key]} onChange={v => setSettingVal(def.key, v)} />
                    ))}
                  </div>
                </div>

                {/* Section: Features */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 18, color: 'var(--text)' }}>
                    ⚡ Features
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {SETTING_DEFS.filter(d => ['donations_enabled', 'music_section_enabled'].includes(d.key)).map(def => (
                      <SettingRow key={def.key} def={def} val={settings[def.key]} onChange={v => setSettingVal(def.key, v)} />
                    ))}
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSaveSettings}
                  disabled={settingsSaving}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {settingsSaving ? 'Saving…' : 'Save All Settings'}
                </button>

                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8 }}>
                  Note: Some settings (like colors or feature toggles) may require a page reload to take effect across the platform.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Settings row component ─────────────────────────────────────────────────
function SettingRow({ def, val, onChange }) {
  const currentVal = val !== undefined ? val : '';

  return (
    <div>
      <label style={{ fontSize: 13, display: 'block', marginBottom: 4, fontWeight: 500 }}>
        {def.label}
      </label>
      {def.description && (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
          {def.description}
        </p>
      )}
      {def.type === 'toggle' ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div
            onClick={() => onChange(currentVal === 'true' || currentVal === true ? 'false' : 'true')}
            style={{
              width: 44, height: 24, borderRadius: 12,
              background: (currentVal === 'true' || currentVal === true) ? 'var(--accent)' : 'var(--surface2)',
              border: '1px solid var(--border)',
              position: 'relative', cursor: 'pointer',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: (currentVal === 'true' || currentVal === true) ? 22 : 2,
              width: 18, height: 18, borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <span style={{ fontSize: 13, color: (currentVal === 'true' || currentVal === true) ? 'var(--success)' : 'var(--muted)' }}>
            {(currentVal === 'true' || currentVal === true) ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      ) : def.type === 'color' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="color"
            value={currentVal || '#4f8ef7'}
            onChange={e => onChange(e.target.value)}
            style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'var(--surface)' }}
          />
          <input
            type="text"
            className="input"
            value={currentVal}
            onChange={e => onChange(e.target.value)}
            placeholder={def.placeholder || '#4f8ef7'}
            maxLength={7}
            style={{ flex: 1, fontFamily: 'monospace' }}
          />
          {currentVal && (
            <span style={{
              width: 28, height: 28, borderRadius: '50%',
              background: currentVal, border: '2px solid var(--border)',
              flexShrink: 0, display: 'inline-block',
            }} title="Preview" />
          )}
        </div>
      ) : (
        <input
          type={def.type === 'number' ? 'number' : 'text'}
          className="input"
          value={currentVal}
          onChange={e => onChange(e.target.value)}
          placeholder={def.placeholder || ''}
        />
      )}
    </div>
  );
}
