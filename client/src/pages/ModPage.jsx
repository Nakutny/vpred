import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { mod } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'DM Serif Display, serif', fontWeight: 400 }}>
          Ban duration for {user.username}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {options.map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="radio"
                name="ban_duration"
                value={opt.value}
                checked={duration === opt.value}
                onChange={() => setDuration(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ fontSize: 13 }}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onConfirm(duration === 0 ? null : duration)}
            style={{ fontSize: 13, background: '#dc2626' }}
          >
            Ban
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── POST EDIT MODAL ──────────────────────────────────────────────────────────
function PostEditModal({ post, onSave, onClose }) {
  const [title, setTitle] = useState(post.title || '');
  const [status, setStatus] = useState(post.status || 'published');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await mod.editPost(post.id, { title, status });
      onSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'DM Serif Display, serif', fontWeight: 400 }}>Edit Post</h3>
        {error && <div style={styles.errorBox}>{error}</div>}
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={styles.input} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={styles.label}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={styles.input}>
            <option value="published">Published</option>
            <option value="removed">Removed</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 13 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 13 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN MOD PAGE ────────────────────────────────────────────────────────────
export default function ModPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [stats, setStats] = useState(null);

  // Users tab
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [banModal, setBanModal] = useState(null);
  const [warnTarget, setWarnTarget] = useState(null);
  const [warnReason, setWarnReason] = useState('');

  // Posts tab
  const [modPosts, setModPosts] = useState([]);
  const [postSearch, setPostSearch] = useState('');
  const [editPost, setEditPost] = useState(null);

  // Reports tab
  const [reports, setReports] = useState([]);
  const [reportStatus, setReportStatus] = useState('open');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Moderator Panel — vpred.org';
    if (!user || !['moderator', 'admin'].includes(user.role)) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    mod.stats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'posts') loadPosts();
    if (tab === 'reports') loadReports();
  }, [tab]);

  const flash = (text, isError = false) => {
    if (isError) setError(text); else setMsg(text);
    setTimeout(() => { setMsg(''); setError(''); }, 3000);
  };

  const loadUsers = useCallback(async () => {
    try { setLoading(true); const d = await mod.users(userSearch); setUsers(d.users); }
    catch (e) { flash(e.message, true); } finally { setLoading(false); }
  }, [userSearch]);

  const loadPosts = useCallback(async () => {
    try { setLoading(true); const d = await mod.posts(postSearch); setModPosts(d.posts); }
    catch (e) { flash(e.message, true); } finally { setLoading(false); }
  }, [postSearch]);

  const loadReports = useCallback(async () => {
    try { setLoading(true); const d = await mod.reports(reportStatus); setReports(d.reports); }
    catch (e) { flash(e.message, true); } finally { setLoading(false); }
  }, [reportStatus]);

  useEffect(() => { if (tab === 'reports') loadReports(); }, [reportStatus]);

  const handleBan = async (u) => {
    if (u.is_banned) {
      try { await mod.banUser(u.id, false); loadUsers(); flash(`${u.username} unbanned.`); }
      catch (e) { flash(e.message, true); }
    } else {
      setBanModal(u);
    }
  };

  const confirmBan = async (duration_days) => {
    const u = banModal;
    setBanModal(null);
    try { await mod.banUser(u.id, true, duration_days); loadUsers(); flash(`${u.username} banned.`); }
    catch (e) { flash(e.message, true); }
  };

  const handleWarn = async () => {
    if (!warnReason.trim()) return;
    try {
      await mod.warnUser(warnTarget.id, warnReason.trim());
      setWarnTarget(null); setWarnReason('');
      flash('Warning issued.');
    } catch (e) { flash(e.message, true); }
  };

  const handleDeletePost = async (p) => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    try { await mod.deletePost(p.id); loadPosts(); flash('Post deleted.'); }
    catch (e) { flash(e.message, true); }
  };

  const handleResolveReport = async (id, status) => {
    try { await mod.resolveReport(id, status); loadReports(); flash('Report updated.'); }
    catch (e) { flash(e.message, true); }
  };

  const handleDemoteSelf = async () => {
    if (!confirm('Are you sure you want to give up your moderator role? You will become a regular user.')) return;
    try {
      await mod.demoteSelf();
      // Update local user state
      if (setUser) setUser(prev => ({ ...prev, role: 'user' }));
      flash('You are now a regular user.');
      setTimeout(() => navigate('/'), 1500);
    } catch (e) { flash(e.message, true); }
  };

  if (!user || !['moderator', 'admin'].includes(user.role)) return null;

  const TABS = [
    { id: 'users', label: 'Users' },
    { id: 'posts', label: 'Posts' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.6rem,3vw,2rem)', fontWeight: 400, margin: 0 }}>
            Moderator Panel
          </h1>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: 13 }}>
            Logged in as <strong>{user.username}</strong> · {user.role}
          </p>
        </div>
        {user.role === 'moderator' && (
          <button
            className="btn btn-secondary"
            onClick={handleDemoteSelf}
            style={{ fontSize: 13, color: 'var(--muted)', borderColor: 'var(--border)' }}
          >
            Resign moderator role
          </button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Open Reports', value: stats.openReports, color: stats.openReports > 0 ? '#f59e0b' : 'var(--text)' },
            { label: 'Banned Users', value: stats.bannedUsers },
            { label: 'Posts (24h)', value: stats.postsLast24h },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Flash messages */}
      {msg && <div style={styles.success}>{msg}</div>}
      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div>
          <div style={styles.searchRow}>
            <input
              placeholder="Search users…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadUsers()}
              style={styles.input}
            />
            <button className="btn btn-secondary" onClick={loadUsers} style={{ fontSize: 13 }}>Search</button>
          </div>
          {loading ? <div style={styles.loading}>Loading…</div> : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Username', 'Email', 'Posts', 'Warnings', 'Status', 'Actions'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={styles.td}><strong>{u.username}</strong></td>
                      <td style={styles.td}><span style={{ color: 'var(--muted)', fontSize: 12 }}>{u.email}</span></td>
                      <td style={styles.td}>{u.post_count}</td>
                      <td style={styles.td}>{u.warning_count}</td>
                      <td style={styles.td}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4,
                          background: u.is_banned ? '#fef2f2' : '#f0fdf4',
                          color: u.is_banned ? '#dc2626' : '#16a34a',
                        }}>
                          {u.is_banned ? (u.ban_expires_at ? `Banned until ${new Date(u.ban_expires_at).toLocaleDateString()}` : 'Banned') : 'Active'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleBan(u)}
                          style={{ fontSize: 12, padding: '4px 10px', background: u.is_banned ? undefined : '#fef2f2', color: u.is_banned ? undefined : '#dc2626', borderColor: u.is_banned ? undefined : '#fca5a5' }}
                        >
                          {u.is_banned ? 'Unban' : 'Ban'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => { setWarnTarget(u); setWarnReason(''); }}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                        >
                          Warn
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: 'var(--muted)' }}>No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── POSTS TAB ── */}
      {tab === 'posts' && (
        <div>
          <div style={styles.searchRow}>
            <input
              placeholder="Search posts…"
              value={postSearch}
              onChange={e => setPostSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadPosts()}
              style={styles.input}
            />
            <button className="btn btn-secondary" onClick={loadPosts} style={{ fontSize: 13 }}>Search</button>
          </div>
          {loading ? <div style={styles.loading}>Loading…</div> : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Title', 'Author', 'Type', 'Status', 'Views', 'Actions'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modPosts.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...styles.td, maxWidth: 220 }}>
                        <a href={`/post/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>
                          {p.title}
                        </a>
                      </td>
                      <td style={styles.td}>{p.author_username}</td>
                      <td style={styles.td}><span style={{ textTransform: 'capitalize', fontSize: 12 }}>{p.type}</span></td>
                      <td style={styles.td}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4,
                          background: p.status === 'published' ? '#f0fdf4' : '#fef2f2',
                          color: p.status === 'published' ? '#16a34a' : '#dc2626',
                        }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={styles.td}>{p.view_count}</td>
                      <td style={{ ...styles.td, display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" onClick={() => setEditPost(p)} style={{ fontSize: 12, padding: '4px 10px' }}>Edit</button>
                        <button className="btn btn-secondary" onClick={() => handleDeletePost(p)} style={{ fontSize: 12, padding: '4px 10px', color: '#dc2626', borderColor: '#fca5a5' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {modPosts.length === 0 && (
                    <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: 'var(--muted)' }}>No posts found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── REPORTS TAB ── */}
      {tab === 'reports' && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            {['open', 'resolved', 'dismissed'].map(s => (
              <button key={s} className="btn btn-secondary" onClick={() => setReportStatus(s)} style={{ fontSize: 12, padding: '4px 12px', fontWeight: reportStatus === s ? 700 : 400 }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {loading ? <div style={styles.loading}>Loading…</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.map(r => (
                <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.target_type} · {r.target_id?.slice(0, 8)}…</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        Reported by <strong>{r.reporter_username}</strong> · {new Date(r.created_at).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 6 }}>"{r.reason}"</div>
                    </div>
                    {r.status === 'open' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" onClick={() => handleResolveReport(r.id, 'resolved')} style={{ fontSize: 12, padding: '4px 10px' }}>Resolve</button>
                        <button className="btn btn-secondary" onClick={() => handleResolveReport(r.id, 'dismissed')} style={{ fontSize: 12, padding: '4px 10px', color: 'var(--muted)' }}>Dismiss</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No {reportStatus} reports.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {banModal && (
        <BanDurationModal
          user={banModal}
          onConfirm={confirmBan}
          onCancel={() => setBanModal(null)}
        />
      )}

      {warnTarget && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: '0 0 14px', fontFamily: 'DM Serif Display, serif', fontWeight: 400 }}>
              Warn {warnTarget.username}
            </h3>
            <textarea
              value={warnReason}
              onChange={e => setWarnReason(e.target.value)}
              placeholder="Reason for warning…"
              rows={4}
              style={{ ...styles.input, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setWarnTarget(null)} style={{ fontSize: 13 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleWarn} style={{ fontSize: 13 }}>Send Warning</button>
            </div>
          </div>
        </div>
      )}

      {editPost && (
        <PostEditModal
          post={editPost}
          onSave={() => { setEditPost(null); loadPosts(); flash('Post updated.'); }}
          onClose={() => setEditPost(null)}
        />
      )}
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  modal: {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
    padding: '28px 32px', minWidth: 320, maxWidth: '90vw',
  },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' },
  tabBtn: {
    padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text)',
  },
  tabActive: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  searchRow: { display: 'flex', gap: 8, marginBottom: 14 },
  input: {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
  },
  label: { display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 500, borderBottom: '1px solid var(--border)', fontSize: 12 },
  td: { padding: '10px 12px', verticalAlign: 'middle' },
  loading: { textAlign: 'center', color: 'var(--muted)', padding: '24px 0' },
  success: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 },
  errorBox: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 },
};
