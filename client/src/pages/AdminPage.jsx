import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    admin.stats().then(setStats).catch(() => {});
  }, [isAdmin]);

  if (!isAdmin) return null;

  const tabs = [
    { key: 'users', label: 'Users' },
    { key: 'posts', label: 'Posts' },
    { key: 'comments', label: 'Comments' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400 }}>Admin Panel</h1>
        {stats && (
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Users', val: stats.users },
              { label: 'Posts', val: stats.posts },
              { label: 'Comments', val: stats.comments },
              { label: 'Warnings', val: stats.warnings },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 18px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', fontSize: 14,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--text)' : 'var(--muted)',
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab currentUserId={user?.id} />}
      {tab === 'posts' && <PostsTab />}
      {tab === 'comments' && <CommentsTab />}
    </div>
  );
}

/* ─── USERS TAB ─── */
function UsersTab({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null); // user detail modal

  async function load(q) {
    setLoading(true);
    try {
      const res = await admin.users(q);
      setUsers(res.users || []);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(''); }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(search);
  }

  async function toggleBan(u) {
    try {
      await admin.banUser(u.id, !u.is_banned);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_banned: !u.is_banned } : x));
    } catch (e) { alert(e.message); }
  }

  async function setRole(u, role) {
    try {
      await admin.setRole(u.id, role);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role } : x));
    } catch (e) { alert(e.message); }
  }

  async function deleteUser(u) {
    if (!confirm(`Permanently delete account "${u.username}"? This cannot be undone.`)) return;
    try {
      await admin.deleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      setSelectedUser(null);
    } catch (e) { alert(e.message); }
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="input"
          style={{ flex: 1, height: 36, fontSize: 13 }}
          placeholder="Search by username or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        {search && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setSearch(''); load(''); }}>Clear</button>}
      </form>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Email', 'Role', 'Posts', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar avatarUrl={u.avatar_url} username={u.username} size={30} />
                      <button
                        onClick={() => setSelectedUser(u)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, color: 'var(--accent)', fontSize: 13, padding: 0 }}
                      >
                        {u.username}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{u.email}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <select
                      value={u.role}
                      onChange={e => setRole(u, e.target.value)}
                      disabled={u.id === currentUserId}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{u.post_count || 0}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: u.is_banned ? 'rgba(224,82,82,0.1)' : 'rgba(76,175,125,0.1)',
                      color: u.is_banned ? 'var(--danger)' : 'var(--success)',
                    }}>
                      {u.is_banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>
                    {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setSelectedUser(u)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}
                      >
                        Details
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => toggleBan(u)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: '1px solid',
                            borderColor: u.is_banned ? 'var(--success)' : 'var(--danger)',
                            background: 'transparent', cursor: 'pointer', fontSize: 12,
                            color: u.is_banned ? 'var(--success)' : 'var(--danger)',
                          }}
                        >
                          {u.is_banned ? 'Unban' : 'Ban'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No users found.</div>
          )}
        </div>
      )}

      {selectedUser && (
        <UserDetailModal
          userId={selectedUser.id}
          onClose={() => setSelectedUser(null)}
          onDelete={deleteUser}
          onBanToggle={toggleBan}
          currentUserId={currentUserId}
          onWarnSuccess={() => {}}
        />
      )}
    </div>
  );
}

/* ─── USER DETAIL MODAL ─── */
function UserDetailModal({ userId, onClose, onDelete, onBanToggle, currentUserId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [warnReason, setWarnReason] = useState('');
  const [warnLoading, setWarnLoading] = useState(false);
  const [warnMsg, setWarnMsg] = useState('');

  useEffect(() => {
    admin.userDetail(userId).then(setDetail).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  async function issueWarning() {
    if (!warnReason.trim()) return;
    setWarnLoading(true);
    try {
      await admin.warnUser(userId, warnReason.trim());
      setWarnMsg('Warning issued successfully.');
      setWarnReason('');
      // Reload detail
      const d = await admin.userDetail(userId);
      setDetail(d);
    } catch (e) {
      setWarnMsg('Error: ' + e.message);
    } finally {
      setWarnLoading(false);
      setTimeout(() => setWarnMsg(''), 4000);
    }
  }

  async function removeWarning(warningId) {
    try {
      await admin.removeWarning(warningId);
      const d = await admin.userDetail(userId);
      setDetail(d);
    } catch (e) { alert(e.message); }
  }

  const u = detail?.user;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 24px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, width: '100%', maxWidth: 620,
          padding: '28px', position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--muted)' }}
        >
          ×
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
        ) : !u ? (
          <div style={{ color: 'var(--danger)' }}>User not found.</div>
        ) : (
          <>
            {/* User header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <Avatar avatarUrl={u.avatar_url} username={u.username} size={56} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{u.username}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{u.email}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: u.role === 'admin' ? 'rgba(99,102,241,0.1)' : u.role === 'moderator' ? 'rgba(245,158,11,0.1)' : 'var(--surface2)',
                    color: u.role === 'admin' ? '#6366f1' : u.role === 'moderator' ? '#f59e0b' : 'var(--muted)',
                  }}>
                    {u.role}
                  </span>
                  {u.is_banned && (
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(224,82,82,0.1)', color: 'var(--danger)' }}>
                      Banned
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 24, padding: '16px', background: 'var(--surface2)', borderRadius: 10 }}>
              {[
                { label: 'Posts', val: u.post_count || 0 },
                { label: 'Comments', val: u.comment_count || 0 },
                { label: 'Warnings', val: detail.warnings?.length || 0 },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Joined</div>
                <div style={{ fontSize: 13 }}>{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            </div>

            {/* Bio */}
            {u.bio && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, fontSize: 13, color: 'var(--muted)' }}>
                {u.bio}
              </div>
            )}

            {/* Admin actions */}
            {u.id !== currentUserId && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                <Link
                  to={`/profile/${u.username}`}
                  target="_blank"
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', textDecoration: 'none' }}
                >
                  View profile
                </Link>
                <button
                  onClick={() => onBanToggle(u)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: '1px solid',
                    borderColor: u.is_banned ? 'var(--success)' : 'var(--border)',
                    background: 'transparent', cursor: 'pointer', fontSize: 13,
                    color: u.is_banned ? 'var(--success)' : 'var(--text)',
                  }}
                >
                  {u.is_banned ? 'Unban user' : 'Ban user'}
                </button>
                <button
                  onClick={() => onDelete(u)}
                  style={{
                    padding: '7px 14px', borderRadius: 8,
                    border: '1px solid var(--danger)',
                    background: 'rgba(224,82,82,0.08)', cursor: 'pointer', fontSize: 13, color: 'var(--danger)',
                  }}
                >
                  Delete account
                </button>
              </div>
            )}

            {/* Issue warning */}
            {u.id !== currentUserId && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Issue a warning</h3>
                <textarea
                  className="input"
                  style={{ minHeight: 72, resize: 'vertical', marginBottom: 8, fontSize: 13 }}
                  placeholder="Reason for the warning (visible in admin only)…"
                  value={warnReason}
                  onChange={e => setWarnReason(e.target.value)}
                />
                {warnMsg && (
                  <p style={{ fontSize: 12, marginBottom: 8, color: warnMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
                    {warnMsg}
                  </p>
                )}
                <button
                  onClick={issueWarning}
                  disabled={warnLoading || !warnReason.trim()}
                  className="btn btn-ghost btn-sm"
                  style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                >
                  {warnLoading ? 'Sending…' : 'Issue warning'}
                </button>
              </div>
            )}

            {/* Warning history */}
            {detail.warnings?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Warning history</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.warnings.map(w => (
                    <div key={w.id} style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: 'rgba(224,82,82,0.05)', border: '1px solid rgba(224,82,82,0.2)',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{w.reason}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          by {w.warned_by_username || 'admin'} · {timeAgo(w.created_at)}
                        </div>
                      </div>
                      <button
                        onClick={() => removeWarning(w.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--muted)' }}
                        title="Remove warning"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent posts */}
            {detail.recentPosts?.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Recent posts</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.recentPosts.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 8,
                      background: 'var(--surface2)', fontSize: 13,
                    }}>
                      <span style={{
                        padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                        background: p.status === 'published' ? 'rgba(76,175,125,0.1)' : 'rgba(224,82,82,0.1)',
                        color: p.status === 'published' ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {p.status}
                      </span>
                      <Link
                        to={`/post/${p.slug}`}
                        target="_blank"
                        style={{ flex: 1, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {p.title}
                      </Link>
                      <span style={{ color: 'var(--muted)', fontSize: 11, flexShrink: 0 }}>
                        {p.view_count} views · {timeAgo(p.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── POSTS TAB ─── */
function PostsTab() {
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(q) {
    setLoading(true);
    try {
      const res = await admin.posts(q);
      setPosts(res.posts || []);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(''); }, []);

  async function setStatus(id, status) {
    try {
      await admin.setPostStatus(id, status);
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    } catch (e) { alert(e.message); }
  }

  async function deletePost(p) {
    if (!confirm(`Permanently delete "${p.title}"?`)) return;
    try {
      await admin.deletePost(p.id);
      setPosts(prev => prev.filter(x => x.id !== p.id));
    } catch (e) { alert(e.message); }
  }

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); load(search); }} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="input"
          style={{ flex: 1, height: 36, fontSize: 13 }}
          placeholder="Search by title or author…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        {search && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setSearch(''); load(''); }}>Clear</button>}
      </form>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Title', 'Author', 'Type', 'Status', 'Views', 'Published', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', maxWidth: 280 }}>
                    <Link
                      to={`/post/${p.slug}`}
                      target="_blank"
                      style={{ color: 'var(--text)', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{p.author_username || '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{p.type || 'research'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: p.status === 'published' ? 'rgba(76,175,125,0.1)' : 'rgba(224,82,82,0.1)',
                      color: p.status === 'published' ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{p.view_count || 0}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{timeAgo(p.created_at)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.status === 'published' ? (
                        <button
                          onClick={() => setStatus(p.id, 'removed')}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--danger)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--danger)' }}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={() => setStatus(p.id, 'published')}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--success)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--success)' }}
                        >
                          Restore
                        </button>
                      )}
                      <button
                        onClick={() => deletePost(p)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--danger)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No posts found.</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── COMMENTS TAB ─── */
function CommentsTab() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.comments().then(res => setComments(res.comments || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function toggleRemove(c) {
    try {
      await admin.removeComment(c.id, !c.is_removed);
      setComments(prev => prev.map(x => x.id === c.id ? { ...x, is_removed: !c.is_removed } : x));
    } catch (e) { alert(e.message); }
  }

  return (
    <div>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Author', 'Comment', 'Post', 'Status', 'Posted', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comments.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', opacity: c.is_removed ? 0.6 : 1 }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{c.author_username || '—'}</td>
                  <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: c.is_removed ? 'var(--muted)' : 'var(--text)', fontStyle: c.is_removed ? 'italic' : 'normal' }}>
                      {c.content}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {c.post_slug && (
                      <Link to={`/post/${c.post_slug}`} target="_blank" style={{ color: 'var(--accent)', fontSize: 12 }}>
                        {c.post_title?.slice(0, 32)}…
                      </Link>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: c.is_removed ? 'rgba(224,82,82,0.1)' : 'rgba(76,175,125,0.1)',
                      color: c.is_removed ? 'var(--danger)' : 'var(--success)',
                    }}>
                      {c.is_removed ? 'Removed' : 'Visible'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{timeAgo(c.created_at)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => toggleRemove(c)}
                      style={{
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid',
                        borderColor: c.is_removed ? 'var(--success)' : 'var(--danger)',
                        background: 'transparent', cursor: 'pointer', fontSize: 12,
                        color: c.is_removed ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {c.is_removed ? 'Restore' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
              {comments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No comments.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
