import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 30) return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return 'just now';
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const TAB_STYLE = (active) => ({
  padding: '8px 14px', background: 'none', border: 'none',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  cursor: 'pointer', fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--text)' : 'var(--muted)',
  marginBottom: -1, transition: 'all 0.15s', whiteSpace: 'nowrap',
});

// ─── BAN DURATION MODAL ───────────────────────────────────────────────────────
function BanDurationModal({ user, onConfirm, onCancel }) {
  const [duration, setDuration] = useState(1);
  const options = [
    { label: '1 day', value: 1 },
    { label: '3 days', value: 3 },
    { label: '7 days', value: 7 },
    { label: '14 days', value: 14 },
    { label: '30 days', value: 30 },
    { label: 'Permanent', value: 0 },
  ];
  return (
    <div style={OVERLAY}>
      <div style={MODAL}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'DM Serif Display, serif', fontWeight: 400 }}>
          Ban duration for {user.username}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {options.map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
              <input type="radio" name="ban_dur" value={opt.value} checked={duration === opt.value} onChange={() => setDuration(opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-sm" onClick={() => onConfirm(duration === 0 ? null : duration)}
            style={{ background: '#dc2626', color: '#fff', border: 'none' }}>
            Confirm Ban
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ADMIN PAGE ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    document.title = 'Admin Panel — vpred.org';
    if (!isAdmin) { navigate('/'); return; }
    admin.stats().then(setStats).catch(() => {});
  }, [isAdmin, navigate]);

  if (!isAdmin) return null;

  const tabs = [
    { key: 'users',    label: 'Users' },
    { key: 'posts',    label: 'Posts' },
    { key: 'deleted',  label: 'Deleted Posts' },
    { key: 'comments', label: 'Comments' },
    { key: 'reports',  label: stats?.openReports ? `Reports (${stats.openReports})` : 'Reports' },
    { key: 'messages', label: 'Messages' },
    { key: 'ip-bans',  label: 'IP Bans' },
    { key: 'audit',    label: 'Audit Log' },
    { key: 'traffic',  label: 'Traffic' },
    { key: 'anomalies',label: 'Anomalies' },
    { key: 'db',       label: 'DB Status' },
  ];

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, margin: 0 }}>Admin Panel</h1>
        {stats && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Users', val: stats.users },
              { label: 'Posts', val: stats.posts },
              { label: 'Comments', val: stats.comments },
              { label: 'Warnings', val: stats.warnings },
              { label: 'Reports', val: stats.openReports, warn: stats.openReports > 0 },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.warn ? '#dc2626' : 'var(--text)' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={TAB_STYLE(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users'     && <UsersTab currentUserId={user?.id} />}
      {tab === 'posts'     && <PostsTab />}
      {tab === 'deleted'   && <DeletedPostsTab />}
      {tab === 'comments'  && <CommentsTab />}
      {tab === 'reports'   && <ReportsTab />}
      {tab === 'messages'  && <MessagesTab />}
      {tab === 'ip-bans'   && <IpBansTab />}
      {tab === 'audit'     && <AuditTab />}
      {tab === 'traffic'   && <TrafficTab />}
      {tab === 'anomalies' && <AnomaliesTab />}
      {tab === 'db'        && <DbStatusTab />}
    </div>
  );
}

// ─── USERS TAB ────────────────────────────────────────────────────────────────
function UsersTab({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [banModal, setBanModal] = useState(null);

  const load = useCallback(async (q) => {
    setLoading(true);
    try { const res = await admin.users(q); setUsers(res.users || []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(''); }, [load]);

  async function toggleBan(u) {
    if (u.is_banned) {
      try { await admin.banUser(u.id, false, null); load(search); }
      catch (e) { alert(e.message); }
    } else {
      setBanModal(u);
    }
  }

  async function confirmBan(duration_days) {
    const u = banModal; setBanModal(null);
    try { await admin.banUser(u.id, true, duration_days); load(search); }
    catch (e) { alert(e.message); }
  }

  async function setRole(u, role) {
    try { await admin.setRole(u.id, role); setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role } : x)); }
    catch (e) { alert(e.message); }
  }

  async function deleteUser(u) {
    if (!confirm(`Delete account "${u.username}"?`)) return;
    try { await admin.deleteUser(u.id); setUsers(prev => prev.filter(x => x.id !== u.id)); }
    catch (e) { alert(e.message); }
  }

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); load(search); }} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 200, height: 36, fontSize: 13 }} placeholder="Search by username or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        {search && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setSearch(''); load(''); }}>Reset</button>}
        <a href={admin.exportUsers()} download="users.csv" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>CSV Export</a>
      </form>

      {loading ? <div style={MUTED_CENTER}>Loading…</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Email', 'Role', 'Posts', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar avatarUrl={u.avatar_url} username={u.username} size={28} />
                      <span style={{ fontWeight: 500 }}>{u.username}</span>
                      {u.is_verified && <span style={{ fontSize: 11, color: '#3b82f6' }}>✓</span>}
                    </div>
                  </td>
                  <td style={{ ...TD, color: 'var(--muted)', fontSize: 12 }}>{u.email}</td>
                  <td style={TD}>
                    <select value={u.role} onChange={e => setRole(u, e.target.value)} disabled={u.id === currentUserId}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td style={TD}>{u.post_count || 0}</td>
                  <td style={TD}>
                    {u.is_banned
                      ? <span style={BADGE_RED}>{u.ban_expires_at ? `Until ${new Date(u.ban_expires_at).toLocaleDateString()}` : 'Banned'}</span>
                      : <span style={BADGE_GREEN}>Active</span>
                    }
                  </td>
                  <td style={{ ...TD, color: 'var(--muted)', fontSize: 12 }}>{timeAgo(u.created_at)}</td>
                  <td style={{ ...TD, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleBan(u)}
                      style={{ color: u.is_banned ? '#16a34a' : '#dc2626' }}>
                      {u.is_banned ? 'Unban' : 'Ban'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => deleteUser(u)}>Delete</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={7} style={MUTED_CENTER}>No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {banModal && <BanDurationModal user={banModal} onConfirm={confirmBan} onCancel={() => setBanModal(null)} />}
    </div>
  );
}

// ─── POSTS TAB ────────────────────────────────────────────────────────────────
function PostsTab() {
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q) => {
    setLoading(true);
    try { const res = await admin.posts(q); setPosts(res.posts || []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(''); }, [load]);

  async function softDelete(p) {
    if (!confirm(`Delete "${p.title}"? (Can be restored)`)) return;
    try { await admin.deletePost(p.id); load(search); }
    catch (e) { alert(e.message); }
  }

  async function setStatus(id, status) {
    try { await admin.setPostStatus(id, status); load(search); }
    catch (e) { alert(e.message); }
  }

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); load(search); }} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 200, height: 36, fontSize: 13 }} placeholder="Search posts…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        {search && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setSearch(''); load(''); }}>Reset</button>}
        <a href={admin.exportPosts()} download="posts.csv" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>CSV Export</a>
      </form>
      {loading ? <div style={MUTED_CENTER}>Loading…</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Title', 'Author', 'Type', 'Status', 'Views', 'Date', 'Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {posts.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...TD, maxWidth: 240 }}>
                    <a href={`/post/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 13 }}>{p.title}</a>
                  </td>
                  <td style={TD}>{p.author_username}</td>
                  <td style={TD}><span style={{ textTransform: 'capitalize', fontSize: 12 }}>{p.type}</span></td>
                  <td style={TD}>
                    <select value={p.status} onChange={e => setStatus(p.id, e.target.value)}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
                      <option value="published">published</option>
                      <option value="removed">removed</option>
                      <option value="draft">draft</option>
                    </select>
                  </td>
                  <td style={TD}>{p.view_count}</td>
                  <td style={{ ...TD, color: 'var(--muted)', fontSize: 12 }}>{timeAgo(p.created_at)}</td>
                  <td style={TD}>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => softDelete(p)}>Delete</button>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && <tr><td colSpan={7} style={MUTED_CENTER}>No posts.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── DELETED POSTS TAB (Restore / Permanent Delete) ───────────────────────────
function DeletedPostsTab() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await admin.deletedPosts(); setPosts(res.posts || []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function restore(p) {
    try { await admin.restorePost(p.id); load(); }
    catch (e) { alert(e.message); }
  }

  async function permDelete(p) {
    if (!confirm(`Permanently delete "${p.title}"? This cannot be undone.`)) return;
    try { await admin.permanentDeletePost(p.id); load(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Deleted posts are kept here indefinitely. You can restore them or permanently remove them.
      </p>
      {loading ? <div style={MUTED_CENTER}>Loading…</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Title', 'Author', 'Type', 'Deleted by', 'Deleted at', 'Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {posts.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...TD, maxWidth: 240, color: 'var(--muted)' }}>{p.title}</td>
                  <td style={TD}>{p.author_username || '—'}</td>
                  <td style={TD}><span style={{ textTransform: 'capitalize', fontSize: 12 }}>{p.type}</span></td>
                  <td style={TD}>{p.deleted_by_username || '—'}</td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--muted)' }}>{timeAgo(p.deleted_at)}</td>
                  <td style={{ ...TD, display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#16a34a' }} onClick={() => restore(p)}>Restore</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => permDelete(p)}>Delete permanently</button>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && <tr><td colSpan={6} style={MUTED_CENTER}>No deleted posts.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── COMMENTS TAB ─────────────────────────────────────────────────────────────
function CommentsTab() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.comments().then(r => setComments(r.comments || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function toggleRemove(c) {
    try {
      await admin.removeComment(c.id, !c.is_removed);
      setComments(prev => prev.map(x => x.id === c.id ? { ...x, is_removed: !x.is_removed } : x));
    } catch (e) { alert(e.message); }
  }

  return (
    <div>
      {loading ? <div style={MUTED_CENTER}>Loading…</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Author', 'Content', 'Post', 'Status', 'Date', 'Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {comments.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', opacity: c.is_removed ? 0.5 : 1 }}>
                  <td style={TD}>{c.author_username}</td>
                  <td style={{ ...TD, maxWidth: 280, color: 'var(--muted)', fontSize: 12 }}>{c.content?.slice(0, 100)}</td>
                  <td style={{ ...TD, fontSize: 12 }}>
                    <a href={`/post/${c.post_slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{c.post_title?.slice(0, 40)}</a>
                  </td>
                  <td style={TD}>{c.is_removed ? <span style={BADGE_RED}>Removed</span> : <span style={BADGE_GREEN}>Visible</span>}</td>
                  <td style={{ ...TD, color: 'var(--muted)', fontSize: 12 }}>{timeAgo(c.created_at)}</td>
                  <td style={TD}>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleRemove(c)}
                      style={{ color: c.is_removed ? '#16a34a' : '#dc2626' }}>
                      {c.is_removed ? 'Restore' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
              {comments.length === 0 && <tr><td colSpan={6} style={MUTED_CENTER}>No comments.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── REPORTS TAB ──────────────────────────────────────────────────────────────
function ReportsTab() {
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    admin.reports(status).then(r => setReports(r.reports || [])).catch(console.error).finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function resolve(id, s) {
    try { await admin.resolveReport(id, s); load(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['open', 'resolved', 'dismissed'].map(s => (
          <button key={s} className="btn btn-ghost btn-sm" onClick={() => setStatus(s)} style={{ fontWeight: status === s ? 700 : 400 }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <div style={MUTED_CENTER}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.target_type} · <span style={{ color: 'var(--muted)' }}>{r.target_id?.slice(0, 8)}…</span></div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Reported by <strong>{r.reporter_username}</strong> · {timeAgo(r.created_at)}</div>
                  <div style={{ fontSize: 13, marginTop: 6, color: 'var(--muted)' }}>"{r.reason}"</div>
                </div>
                {r.status === 'open' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => resolve(r.id, 'resolved')}>Resolve</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--muted)' }} onClick={() => resolve(r.id, 'dismissed')}>Dismiss</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {reports.length === 0 && <div style={MUTED_CENTER}>No {status} reports.</div>}
        </div>
      )}
    </div>
  );
}

// ─── MESSAGES TAB (Admin DM viewer) ──────────────────────────────────────────
function MessagesTab() {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const load = useCallback(async (s = search, o = 0) => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset: o };
      if (s) params.search = s;
      const res = await admin.messages(params);
      if (o === 0) setMessages(res.messages || []);
      else setMessages(prev => [...prev, ...(res.messages || [])]);
      setTotal(res.total || 0);
      setOffset(o);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load('', 0); }, []);

  async function deleteMsg(id) {
    if (!confirm('Delete this message?')) return;
    try { await admin.deleteMessage(id); setMessages(prev => prev.filter(m => m.id !== id)); setTotal(t => t - 1); }
    catch (e) { alert(e.message); }
  }

  return (
    <div>
      <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
        🔒 Private messages are visible to admins for moderation purposes only.
        All messages are automatically deleted after 7 days.
      </div>
      <form onSubmit={e => { e.preventDefault(); load(search, 0); }} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input className="input" style={{ flex: 1, height: 36, fontSize: 13 }} placeholder="Search by user or content…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        {search && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setSearch(''); load('', 0); }}>Reset</button>}
      </form>
      <div style={{ marginBottom: 8, color: 'var(--muted)', fontSize: 12 }}>{total} message{total !== 1 ? 's' : ''} total</div>
      {loading && messages.length === 0 ? <div style={MUTED_CENTER}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(m => (
            <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{m.sender_username}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12, margin: '0 6px' }}>→</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{m.receiver_username}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 10 }}>{timeAgo(m.created_at)}</span>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => deleteMsg(m.id)}>Delete</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word' }}>{m.content}</div>
            </div>
          ))}
          {messages.length === 0 && <div style={MUTED_CENTER}>No messages found.</div>}
          {messages.length < total && (
            <button className="btn btn-ghost btn-sm" onClick={() => load(search, offset + LIMIT)} style={{ alignSelf: 'center', marginTop: 8 }}>
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── IP BANS TAB ──────────────────────────────────────────────────────────────
function IpBansTab() {
  const [bans, setBans] = useState([]);
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.ipBans().then(r => setBans(r.bans || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!ip.trim()) return;
    try {
      await admin.addIpBan(ip.trim(), reason.trim());
      setIp(''); setReason('');
      const res = await admin.ipBans(); setBans(res.bans || []);
    } catch (e) { alert(e.message); }
  }

  async function remove(id) {
    try { await admin.removeIpBan(id); setBans(prev => prev.filter(b => b.id !== id)); }
    catch (e) { alert(e.message); }
  }

  return (
    <div>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 2, minWidth: 160, height: 36, fontSize: 13 }} placeholder="IP address…" value={ip} onChange={e => setIp(e.target.value)} />
        <input className="input" style={{ flex: 3, minWidth: 160, height: 36, fontSize: 13 }} placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
        <button className="btn btn-primary btn-sm" type="submit">Add ban</button>
      </form>
      {loading ? <div style={MUTED_CENTER}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bans.map(b => (
            <div key={b.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{b.ip_address}</span>
                {b.reason && <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 10 }}>{b.reason}</span>}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Banned by {b.banned_by_username} · {timeAgo(b.created_at)}</div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => remove(b.id)}>Remove</button>
            </div>
          ))}
          {bans.length === 0 && <div style={MUTED_CENTER}>No IP bans.</div>}
        </div>
      )}
    </div>
  );
}

// ─── AUDIT LOG TAB ────────────────────────────────────────────────────────────
function AuditTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.auditLog().then(r => setEntries(r.entries || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {loading ? <div style={MUTED_CENTER}>Loading…</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Admin', 'Action', 'Target', 'Details', 'When'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <td style={TD}>{e.admin_username}</td>
                  <td style={TD}><code style={{ fontSize: 11 }}>{e.action}</code></td>
                  <td style={TD}>{e.target_type && <span style={{ color: 'var(--muted)' }}>{e.target_type} · {String(e.target_id || '').slice(0, 8)}</span>}</td>
                  <td style={{ ...TD, color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.details && typeof e.details === 'object' ? JSON.stringify(e.details).slice(0, 80) : ''}
                  </td>
                  <td style={{ ...TD, color: 'var(--muted)' }}>{timeAgo(e.created_at)}</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={5} style={MUTED_CENTER}>No entries.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── TRAFFIC / VISITOR LOG TAB ────────────────────────────────────────────────
function TrafficTab() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.visitorLog(200, 0).then(r => { setEntries(r.entries || []); setTotal(r.total || 0); }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 10, color: 'var(--muted)', fontSize: 13 }}>Showing last 200 of {total} entries. Logs are auto-pruned to keep DB lean.</div>
      {loading ? <div style={MUTED_CENTER}>Loading…</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['IP', 'Method', 'Path', 'Status', 'User', 'When'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11 }}>{e.ip}</td>
                  <td style={TD}>{e.method}</td>
                  <td style={{ ...TD, color: 'var(--muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.path}</td>
                  <td style={TD}>
                    <span style={{ color: e.status >= 400 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{e.status}</span>
                  </td>
                  <td style={TD}>{e.username || '—'}</td>
                  <td style={{ ...TD, color: 'var(--muted)' }}>{timeAgo(e.created_at)}</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={6} style={MUTED_CENTER}>No traffic entries.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ANOMALIES TAB ────────────────────────────────────────────────────────────
function AnomaliesTab() {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    admin.anomalies().then(r => setAnomalies(r.anomalies || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteOne(id) {
    try { await admin.deleteAnomaly(id); setAnomalies(prev => prev.filter(a => a.id !== id)); }
    catch (e) { alert(e.message); }
  }

  async function clearAll() {
    if (!confirm(`Delete all ${anomalies.length} anomalies?`)) return;
    try { await admin.clearAnomalies(); setAnomalies([]); }
    catch (e) { alert(e.message); }
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 10px' }}>
          Anomalies are suspicious entries (high-traffic IPs, scraping patterns, bulk actions) automatically extracted before log cleanup.
        </p>
        {anomalies.length > 0 && (
          <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={clearAll}>
            Delete all anomalies ({anomalies.length})
          </button>
        )}
      </div>
      {loading ? <div style={MUTED_CENTER}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {anomalies.map(a => (
            <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#dc2626' }}>{a.reason}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Source: {a.source} · {timeAgo(a.created_at)}</div>
                  <pre style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 80, overflow: 'auto' }}>
                    {JSON.stringify(a.data, null, 2)}
                  </pre>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626', flexShrink: 0 }} onClick={() => deleteOne(a.id)}>Delete</button>
              </div>
            </div>
          ))}
          {anomalies.length === 0 && <div style={MUTED_CENTER}>No anomalies saved. The system is clean.</div>}
        </div>
      )}
    </div>
  );
}

// ─── DB STATUS TAB ────────────────────────────────────────────────────────────
function DbStatusTab() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    admin.dbStatus().then(setStatus).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runCleanup() {
    setCleaning(true); setCleanMsg('');
    try {
      const r = await admin.runCleanup();
      setCleanMsg(`Done. Deleted: ${r.visitor_log_deleted} traffic rows, ${r.audit_log_deleted} audit rows, ${r.messages_deleted} messages. Anomalies saved: ${r.anomalies_saved}.`);
      load();
    } catch (e) { setCleanMsg('Cleanup failed: ' + e.message); }
    finally { setCleaning(false); }
  }

  return (
    <div>
      {loading ? <div style={MUTED_CENTER}>Loading…</div> : status && (
        <div>
          {/* DB Size */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total DB Size', value: formatBytes(status.db_size_bytes) },
              { label: 'Visitor Log Rows', value: status.visitor_log_count?.toLocaleString() },
              { label: 'Audit Log Rows', value: status.audit_log_count?.toLocaleString() },
              { label: 'Messages', value: status.messages_count?.toLocaleString() },
              { label: 'Anomalies', value: status.anomalies_count?.toLocaleString() },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{s.value ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Table sizes */}
          {status.table_sizes?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Table sizes</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={TABLE}>
                  <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={TH}>Table</th><th style={TH}>Size</th>
                  </tr></thead>
                  <tbody>
                    {status.table_sizes.map(t => (
                      <tr key={t.table_name} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12 }}>{t.table_name}</td>
                        <td style={TD}>{formatBytes(parseInt(t.size_bytes))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Last cleanup info */}
          {status.last_cleanup && (
            <div style={{ marginBottom: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', fontSize: 13 }}>
              <strong>Last cleanup:</strong> {timeAgo(status.last_cleanup.ran_at)}
              <span style={{ color: 'var(--muted)', marginLeft: 12 }}>
                Traffic: −{status.last_cleanup.visitor_log_deleted} · Audit: −{status.last_cleanup.audit_log_deleted} · Messages: −{status.last_cleanup.messages_deleted} · Anomalies saved: {status.last_cleanup.anomalies_saved}
              </span>
            </div>
          )}

          {/* Cleanup strategy explanation */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 18px', marginBottom: 18, fontSize: 13 }}>
            <strong>Cleanup strategy:</strong> The system auto-runs every 30 min.
            It keeps traffic logs to ≤ 5,000 rows and audit logs to ≤ 2,000 rows.
            Suspicious entries (high-traffic IPs, bulk actions) are saved to the <em>Anomalies</em> tab before deletion.
            Messages are deleted after 7 days.
          </div>

          {cleanMsg && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{cleanMsg}</div>
          )}

          <button className="btn btn-primary" onClick={runCleanup} disabled={cleaning}>
            {cleaning ? 'Running cleanup…' : 'Run cleanup now'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: 8 }}>Refresh</button>
        </div>
      )}
    </div>
  );
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const OVERLAY = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 };
const MODAL = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 32px', minWidth: 320, maxWidth: '90vw' };
const TABLE = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const TH = { padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' };
const TD = { padding: '10px 12px', verticalAlign: 'middle' };
const MUTED_CENTER = { textAlign: 'center', padding: '32px', color: 'var(--muted)', fontSize: 13 };
const BADGE_RED = { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(220,38,38,0.1)', color: '#dc2626' };
const BADGE_GREEN = { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(22,163,74,0.1)', color: '#16a34a' };
