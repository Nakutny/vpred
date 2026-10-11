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

const TAB_STYLE = (active) => ({
  padding: '8px 16px', background: 'none', border: 'none',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  cursor: 'pointer', fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--text)' : 'var(--muted)',
  marginBottom: -1, transition: 'all 0.15s', whiteSpace: 'nowrap',
});

function Badge({ r, g, b, text }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: `rgba(${r},${g},${b},0.1)`, color: `rgb(${r},${g},${b})`,
    }}>{text}</span>
  );
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
    { key: 'users', label: 'Nutzer' },
    { key: 'posts', label: 'Posts' },
    { key: 'comments', label: 'Kommentare' },
    { key: 'reports', label: stats?.openReports ? `Reports (${stats.openReports})` : 'Reports' },
    { key: 'ip-bans', label: 'IP-Sperren' },
    { key: 'audit', label: 'Audit-Log' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400 }}>Admin Panel</h1>
        {stats && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Nutzer', val: stats.users },
              { label: 'Posts', val: stats.posts },
              { label: 'Kommentare', val: stats.comments },
              { label: 'Verwarnungen', val: stats.warnings },
              { label: 'Reports', val: stats.openReports, warn: stats.openReports > 0 },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.warn ? 'var(--danger)' : 'var(--text)' }}>{s.val}</div>
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

      {tab === 'users' && <UsersTab currentUserId={user?.id} />}
      {tab === 'posts' && <PostsTab />}
      {tab === 'comments' && <CommentsTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'ip-bans' && <IpBansTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

/* ─── USERS TAB ─── */
function UsersTab({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);

  async function load(q) {
    setLoading(true);
    try { const res = await admin.users(q); setUsers(res.users || []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }
  useEffect(() => { load(''); }, []);

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
    if (!confirm(`Account "${u.username}" wirklich löschen?`)) return;
    try {
      await admin.deleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      setSelectedUser(null);
    } catch (e) { alert(e.message); }
  }

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); load(search); }} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input className="input" style={{ flex: 1, height: 36, fontSize: 13 }} placeholder="Suche nach Username oder E-Mail…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-ghost btn-sm" type="submit">Suchen</button>
        {search && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setSearch(''); load(''); }}>Zurücksetzen</button>}
        <a href={admin.exportUsers()} download="users.csv" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>CSV Export</a>
      </form>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Laden…</div> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nutzer', 'E-Mail', 'Rolle', 'Posts', 'Status', 'Beigetreten', 'Aktionen'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar avatarUrl={u.avatar_url} username={u.username} size={30} />
                      <div>
                        <button onClick={() => setSelectedUser(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, color: 'var(--accent)', fontSize: 13, padding: 0 }}>
                          {u.username}
                        </button>
                        {u.is_verified && <span style={{ marginLeft: 4, fontSize: 11, color: '#3b82f6' }}>✓</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <select value={u.role} onChange={e => setRole(u, e.target.value)} disabled={u.id === currentUserId}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{u.post_count || 0}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {u.is_banned ? <Badge r={224} g={82} b={82} text="Gebannt" /> : <Badge r={76} g={175} b={125} text="Aktiv" />}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString('de-DE')}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setSelectedUser(u)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>Details</button>
                      {u.id !== currentUserId && (
                        <button onClick={() => toggleBan(u)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid', borderColor: u.is_banned ? 'var(--success)' : 'var(--danger)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: u.is_banned ? 'var(--success)' : 'var(--danger)' }}>
                          {u.is_banned ? 'Entbannen' : 'Bannen'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Keine Nutzer gefunden.</div>}
        </div>
      )}

      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} onDelete={deleteUser} onBanToggle={toggleBan} currentUserId={currentUserId} />
      )}
    </div>
  );
}

/* ─── USER DETAIL MODAL ─── */
function UserDetailModal({ user: initialUser, onClose, onDelete, onBanToggle, currentUserId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [warnReason, setWarnReason] = useState('');
  const [warnLoading, setWarnLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function reload() {
    try {
      const d = await admin.userDetail(initialUser.id);
      setDetail(d);
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    admin.userDetail(initialUser.id).then(setDetail).catch(() => {}).finally(() => setLoading(false));
  }, [initialUser.id]);

  async function issueWarning() {
    if (!warnReason.trim()) return;
    setWarnLoading(true);
    try {
      await admin.warnUser(initialUser.id, warnReason.trim());
      setMsg('Verwarnung ausgesprochen.');
      setWarnReason('');
      await reload();
    } catch (e) { setMsg('Fehler: ' + e.message); }
    finally { setWarnLoading(false); setTimeout(() => setMsg(''), 4000); }
  }

  async function removeWarning(warningId) {
    try { await admin.removeWarning(warningId); await reload(); }
    catch (e) { alert(e.message); }
  }

  async function toggleVerify() {
    const u = detail?.user || initialUser;
    try {
      await admin.verifyUser(u.id, !u.is_verified);
      await reload();
    } catch (e) { alert(e.message); }
  }

  const u = detail?.user || initialUser;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 620, padding: 28, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--muted)' }}>×</button>

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Laden…</div> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <Avatar avatarUrl={u.avatar_url} username={u.username} size={56} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {u.username}
                  {u.is_verified && <span style={{ marginLeft: 6, color: '#3b82f6', fontSize: 14 }}>✓ Verifiziert</span>}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{u.email}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {u.role === 'admin' ? <Badge r={99} g={102} b={241} text="Admin" /> : u.role === 'moderator' ? <Badge r={245} g={158} b={11} text="Moderator" /> : <Badge r={120} g={120} b={120} text="User" />}
                  {u.is_banned && <Badge r={224} g={82} b={82} text="Gebannt" />}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 20, marginBottom: 24, padding: 16, background: 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
              {[
                { label: 'Posts', val: u.post_count || 0 },
                { label: 'Kommentare', val: u.comment_count || 0 },
                { label: 'Verwarnungen', val: detail?.warnings?.length || 0 },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Beigetreten</div>
                <div style={{ fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString('de-DE')}</div>
              </div>
            </div>

            {u.bio && <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(0,0,0,0.04)', borderRadius: 8, fontSize: 13, color: 'var(--muted)' }}>{u.bio}</div>}

            {u.id !== currentUserId && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                <Link to={`/profile/${u.username}`} target="_blank" style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', textDecoration: 'none' }}>Profil</Link>
                <button onClick={() => onBanToggle(u)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid', borderColor: u.is_banned ? 'var(--success)' : 'var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: u.is_banned ? 'var(--success)' : 'var(--text)' }}>
                  {u.is_banned ? 'Entbannen' : 'Bannen'}
                </button>
                <button onClick={toggleVerify} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: u.is_verified ? 'var(--danger)' : '#3b82f6' }}>
                  {u.is_verified ? 'Verifikation entziehen' : '✓ Verifizieren'}
                </button>
                <button onClick={() => onDelete(u)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--danger)', background: 'rgba(224,82,82,0.08)', cursor: 'pointer', fontSize: 13, color: 'var(--danger)' }}>Account löschen</button>
              </div>
            )}

            {u.id !== currentUserId && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Verwarnung aussprechen</h3>
                <textarea className="input" style={{ minHeight: 72, resize: 'vertical', marginBottom: 8, fontSize: 13 }} placeholder="Grund der Verwarnung…" value={warnReason} onChange={e => setWarnReason(e.target.value)} />
                {msg && <p style={{ fontSize: 12, marginBottom: 8, color: msg.startsWith('Fehler') ? 'var(--danger)' : 'var(--success)' }}>{msg}</p>}
                <button onClick={issueWarning} disabled={warnLoading || !warnReason.trim()} className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                  {warnLoading ? 'Senden…' : 'Verwarnung aussprechen'}
                </button>
              </div>
            )}

            {detail?.warnings?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Verwarnungshistorie</h3>
                {detail.warnings.map(w => (
                  <div key={w.id} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(224,82,82,0.05)', border: '1px solid rgba(224,82,82,0.2)', display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{w.reason}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>von {w.warned_by_username || 'admin'} · {timeAgo(w.created_at)}</div>
                    </div>
                    <button onClick={() => removeWarning(w.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--muted)' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {detail?.recentPosts?.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Letzte Posts</h3>
                {detail.recentPosts.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.04)', fontSize: 13, marginBottom: 6 }}>
                    {p.status === 'published' ? <Badge r={76} g={175} b={125} text="published" /> : <Badge r={224} g={82} b={82} text={p.status} />}
                    <Link to={`/post/${p.slug}`} target="_blank" style={{ flex: 1, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</Link>
                    <span style={{ color: 'var(--muted)', fontSize: 11, flexShrink: 0 }}>{p.view_count} Views · {timeAgo(p.created_at)}</span>
                  </div>
                ))}
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
  const [selected, setSelected] = useState(new Set());

  async function load(q) {
    setLoading(true);
    try { const res = await admin.posts(q); setPosts(res.posts || []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }
  useEffect(() => { load(''); }, []);

  async function setStatus(id, status) {
    try {
      await admin.setPostStatus(id, status);
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    } catch (e) { alert(e.message); }
  }

  async function deletePost(p) {
    if (!confirm(`Post "${p.title}" wirklich löschen?`)) return;
    try { await admin.deletePost(p.id); setPosts(prev => prev.filter(x => x.id !== p.id)); }
    catch (e) { alert(e.message); }
  }

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function bulkAction(action) {
    if (selected.size === 0) return;
    if (!confirm(`${action === 'delete' ? 'Löschen' : 'Entfernen'}: ${selected.size} Posts?`)) return;
    try {
      await admin.bulkPosts([...selected], action);
      await load(search);
      setSelected(new Set());
    } catch (e) { alert(e.message); }
  }

  const allChecked = posts.length > 0 && selected.size === posts.length;

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); load(search); }} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 200, height: 36, fontSize: 13 }} placeholder="Suche nach Titel oder Autor…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-ghost btn-sm" type="submit">Suchen</button>
        {search && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setSearch(''); load(''); }}>Zurücksetzen</button>}
        <a href={admin.exportPosts()} download="posts.csv" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>CSV Export</a>
        {selected.size > 0 && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => bulkAction('remove')}>Entfernen ({selected.size})</button>
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => bulkAction('delete')}>Löschen ({selected.size})</button>
          </>
        )}
      </form>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Laden…</div> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', width: 32 }}>
                  <input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(posts.map(p => p.id)) : new Set())} checked={allChecked} />
                </th>
                {['Titel', 'Autor', 'Typ', 'Status', 'Views', 'Erstellt', 'Aktionen'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: selected.has(p.id) ? 'rgba(79,142,247,0.04)' : 'transparent' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                  </td>
                  <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                    <Link to={`/post/${p.slug}`} target="_blank" style={{ color: 'var(--text)', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</Link>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{p.author_username || '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', textTransform: 'capitalize' }}>{p.type || 'research'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {p.status === 'published' ? <Badge r={76} g={175} b={125} text="published" /> : <Badge r={224} g={82} b={82} text={p.status} />}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{p.view_count || 0}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{timeAgo(p.created_at)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.status === 'published'
                        ? <button onClick={() => setStatus(p.id, 'removed')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--danger)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--danger)' }}>Entfernen</button>
                        : <button onClick={() => setStatus(p.id, 'published')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--success)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--success)' }}>Wiederherstellen</button>
                      }
                      <button onClick={() => deletePost(p)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--danger)' }}>Löschen</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Keine Posts gefunden.</div>}
        </div>
      )}
    </div>
  );
}

/* ─── KOMMENTARE TAB ─── */
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

  return loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Laden…</div> : (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Autor', 'Kommentar', 'Post', 'Status', 'Erstellt', 'Aktion'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comments.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', opacity: c.is_removed ? 0.6 : 1 }}>
              <td style={{ padding: '10px 14px', fontWeight: 500 }}>{c.author_username || '—'}</td>
              <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.content}</span>
              </td>
              <td style={{ padding: '10px 14px' }}>
                {c.post_slug && <Link to={`/post/${c.post_slug}`} target="_blank" style={{ color: 'var(--accent)', fontSize: 12 }}>{(c.post_title || '').slice(0, 30)}…</Link>}
              </td>
              <td style={{ padding: '10px 14px' }}>
                {c.is_removed ? <Badge r={224} g={82} b={82} text="Entfernt" /> : <Badge r={76} g={175} b={125} text="Sichtbar" />}
              </td>
              <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{timeAgo(c.created_at)}</td>
              <td style={{ padding: '10px 14px' }}>
                <button onClick={() => toggleRemove(c)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid', borderColor: c.is_removed ? 'var(--success)' : 'var(--danger)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: c.is_removed ? 'var(--success)' : 'var(--danger)' }}>
                  {c.is_removed ? 'Wiederherstellen' : 'Entfernen'}
                </button>
              </td>
            </tr>
          ))}
          {comments.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Keine Kommentare.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ─── REPORTS TAB ─── */
function ReportsTab() {
  const [reportsList, setReportsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');

  async function load(s) {
    setLoading(true);
    try { const res = await admin.reports(s); setReportsList(res.reports || []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }
  useEffect(() => { load(statusFilter); }, [statusFilter]);

  async function resolve(id, status) {
    try {
      await admin.resolveReport(id, status);
      setReportsList(prev => prev.filter(r => r.id !== id));
    } catch (e) { alert(e.message); }
  }

  const targetLabel = { post: '📄 Post', comment: '💬 Kommentar', user: '👤 Nutzer' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'open', label: 'Offen' },
          { key: 'resolved', label: 'Erledigt' },
          { key: 'dismissed', label: 'Abgewiesen' },
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: statusFilter === s.key ? 'var(--accent)' : 'transparent', color: statusFilter === s.key ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13 }}>{s.label}</button>
        ))}
      </div>
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Laden…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reportsList.map(r => (
            <div key={r.id} style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{targetLabel[r.target_type] || r.target_type}</span>
                <code style={{ fontSize: 11, color: 'var(--muted)', background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>{r.target_id}</code>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>von <strong>{r.reporter_username || 'anonym'}</strong> · {timeAgo(r.created_at)}</span>
              </div>
              <p style={{ fontSize: 13, marginBottom: 12 }}><strong>Grund:</strong> {r.reason}</p>
              {statusFilter === 'open' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => resolve(r.id, 'resolved')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--success)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--success)' }}>✓ Erledigt</button>
                  <button onClick={() => resolve(r.id, 'dismissed')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>Abweisen</button>
                </div>
              )}
              {statusFilter !== 'open' && r.resolved_by_username && (
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>Bearbeitet von {r.resolved_by_username}</p>
              )}
            </div>
          ))}
          {reportsList.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Keine Reports.</div>}
        </div>
      )}
    </div>
  );
}

/* ─── IP-BANS TAB ─── */
function IpBansTab() {
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try { const res = await admin.ipBans(); setBans(res.bans || []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function addBan(e) {
    e.preventDefault();
    if (!ip.trim()) return;
    setAdding(true);
    try { await admin.addIpBan(ip.trim(), reason.trim()); setIp(''); setReason(''); await load(); }
    catch (err) { alert(err.message); }
    finally { setAdding(false); }
  }

  async function removeBan(id) {
    try { await admin.removeIpBan(id); setBans(prev => prev.filter(b => b.id !== id)); }
    catch (e) { alert(e.message); }
  }

  return (
    <div>
      <form onSubmit={addBan} style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <input className="input" style={{ width: 200, height: 36, fontSize: 13 }} placeholder="IP-Adresse" value={ip} onChange={e => setIp(e.target.value)} />
        <input className="input" style={{ flex: 1, minWidth: 200, height: 36, fontSize: 13 }} placeholder="Grund (optional)" value={reason} onChange={e => setReason(e.target.value)} />
        <button className="btn btn-ghost btn-sm" type="submit" disabled={adding || !ip.trim()} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>IP sperren</button>
      </form>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Laden…</div> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['IP-Adresse', 'Grund', 'Gesperrt von', 'Datum', 'Aktion'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bans.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{b.ip_address}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{b.reason || '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{b.banned_by_username || '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{timeAgo(b.created_at)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => removeBan(b.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--danger)' }}>Aufheben</button>
                  </td>
                </tr>
              ))}
              {bans.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Keine IP-Sperren.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── AUDIT-LOG TAB ─── */
function AuditTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.auditLog().then(res => setEntries(res.entries || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const actionLabel = {
    user_banned: '🚫 Gebannt', user_unbanned: '✅ Entbannt', user_deleted: '🗑️ Account gelöscht',
    user_warned: '⚠️ Verwarnt', user_verified: '✓ Verifiziert', user_unverified: '✗ Verifikation entfernt',
    role_changed: '🔑 Rolle geändert', post_deleted: '🗑️ Post gelöscht', post_status_changed: '📄 Post-Status geändert',
    comment_removed: '💬 Kommentar entfernt', comment_restored: '💬 Kommentar wiederhergestellt',
    report_resolved: '✓ Report erledigt', report_dismissed: '✗ Report abgewiesen',
    ip_banned: '🚫 IP gesperrt', ip_unbanned: '✅ IP-Sperre aufgehoben', message_deleted: '📩 Nachricht gelöscht',
    users_exported_csv: '📊 Nutzer exportiert (CSV)', posts_bulk_deleted: '🗑️ Bulk-Löschung', posts_bulk_removed: '📄 Bulk-Entfernung',
  };

  return loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Laden…</div> : (
    <div className="card" style={{ overflow: 'hidden' }}>
      {entries.map((e, i) => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
          <div style={{ flexShrink: 0, width: 100, color: 'var(--muted)', fontSize: 11 }}>{timeAgo(e.created_at)}</div>
          <div style={{ fontWeight: 600, width: 160, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.admin_username || 'System'}</div>
          <div style={{ flex: 1 }}>{actionLabel[e.action] || e.action}</div>
          {e.target_type && <code style={{ color: 'var(--muted)', fontSize: 11, background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>{e.target_type}:{(e.target_id || '').slice(0, 8)}</code>}
        </div>
      ))}
      {entries.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Keine Einträge.</div>}
    </div>
  );
}
