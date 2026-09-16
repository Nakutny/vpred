import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, categories } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    Promise.all([
      admin.users().then(d => setUsers(d.users || [])),
      categories.list().then(d => setCategoryList(d.categories || [])),
    ]).finally(() => setLoading(false));
  }, [isAdmin]);

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

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

  function RoleBadge({ role }) {
    const colors = { admin: '#4f8ef7', moderator: '#4caf7d', user: '#7a8099' };
    return (
      <span style={{
        padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
        background: colors[role] + '22', color: colors[role],
      }}>
        {role}
      </span>
    );
  }

  const tabs = [
    { id: 'users', label: 'Users' },
    { id: 'categories', label: 'Categories' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400 }}>Admin Panel</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Manage users, categories and platform settings.</p>
      </div>

      {msg && (
        <div style={{ background: 'rgba(76,175,125,0.15)', border: '1px solid var(--success)', borderRadius: 7, padding: '10px 16px', marginBottom: 20, color: 'var(--success)', fontSize: 14 }}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? 'var(--text)' : 'var(--muted)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)' }}>Loading...</div>
      ) : (
        <>
          {/* Users tab */}
          {tab === 'users' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Username', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', fontFamily: 'DM Sans, sans-serif' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff' }}>
                            {u.username[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{u.username}</span>
                          {u.id === user.id && <span style={{ fontSize: 11, color: 'var(--muted)' }}>(you)</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13 }}>{u.email}</td>
                      <td style={{ padding: '12px 16px' }}><RoleBadge role={u.role} /></td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, color: u.is_banned ? 'var(--danger)' : 'var(--success)', fontWeight: 500 }}>
                          {u.is_banned ? 'Banned' : 'Active'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13 }}>
                        {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {u.id !== user.id && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleBan(u.id, u.is_banned)} className="btn btn-ghost btn-sm"
                              style={{ color: u.is_banned ? 'var(--success)' : 'var(--danger)', fontSize: 12 }}>
                              {u.is_banned ? 'Unban' : 'Ban'}
                            </button>
                            <button onClick={() => handleRole(u.id, u.role)} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                              → {u.role === 'admin' ? 'user' : u.role === 'moderator' ? 'admin' : 'mod'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Categories tab */}
          {tab === 'categories' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28 }}>
              {/* List */}
              <div className="card" style={{ overflow: 'hidden', alignSelf: 'start' }}>
                {categoryList.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No categories yet.</div>
                ) : (
                  categoryList.map((c, i) => (
                    <div key={c.id} style={{ padding: '14px 20px', borderBottom: i < categoryList.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</div>
                        {c.description && <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{c.description}</div>}
                        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{c.post_count} posts</div>
                      </div>
                      <button onClick={() => handleDeleteCategory(c.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add form */}
              <div className="card" style={{ padding: '20px 22px', alignSelf: 'start' }}>
                <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', fontWeight: 400, marginBottom: 16 }}>Add Category</h3>
                <form onSubmit={handleAddCategory}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Name *</label>
                    <input
                      className="input"
                      placeholder="e.g. Politics"
                      value={newCategory.name}
                      onChange={e => setNewCategory(p => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Description</label>
                    <textarea
                      className="input"
                      style={{ minHeight: 70, resize: 'vertical' }}
                      placeholder="Short description..."
                      value={newCategory.description}
                      onChange={e => setNewCategory(p => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Create category
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
