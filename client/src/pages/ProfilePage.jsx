import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { profile as profileApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import PostCard from '../components/PostCard';

export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('posts');

  // Bio edit
  const [bio, setBio] = useState('');
  const [bioMsg, setBioMsg] = useState('');
  const [bioSaving, setBioSaving] = useState(false);

  // Password change
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const isOwn = user?.username === username;

  useEffect(() => {
    setLoading(true);
    profileApi.get(username)
      .then(d => {
        setData(d);
        setBio(d.user.bio || '');
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [username]);

  function flash(setter, msg, duration = 3000) {
    setter(msg);
    setTimeout(() => setter(''), duration);
  }

  async function handleBioSave(e) {
    e.preventDefault();
    setBioSaving(true);
    try {
      await profileApi.updateBio(bio);
      setData(d => ({ ...d, user: { ...d.user, bio } }));
      flash(setBioMsg, 'Bio updated.');
    } catch (err) {
      flash(setBioMsg, 'Error: ' + err.message);
    } finally {
      setBioSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwError('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      return setPwError('Passwords do not match.');
    }
    setPwSaving(true);
    try {
      await profileApi.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      flash(setPwMsg, 'Password changed successfully.');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days > 30) return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (days > 0) return `${days}d ago`;
    return 'today';
  }

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '60px auto', padding: '0 24px', color: 'var(--muted)' }}>Loading...</div>
  );

  if (!data) return null;

  const tabs = [
    { id: 'posts', label: `Posts (${data.posts.length})` },
    ...(isOwn ? [
      { id: 'edit', label: 'Edit profile' },
      { id: 'password', label: 'Change password' },
    ] : []),
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      {/* Profile header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 36, paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
        {/* Avatar */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--accent)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 600, color: '#fff',
        }}>
          {data.user.username[0].toUpperCase()}
        </div>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 4 }}>
            {data.user.username}
          </h1>
          {data.user.bio ? (
            <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.6, maxWidth: 500, marginBottom: 10 }}>
              {data.user.bio}
            </p>
          ) : isOwn ? (
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 10, fontStyle: 'italic' }}>
              No bio yet. Add one below.
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>{data.posts.length}</strong> posts
            </span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              Joined {timeAgo(data.user.created_at)}
            </span>
          </div>
        </div>
      </div>

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

      {/* Posts tab */}
      {tab === 'posts' && (
        <div>
          {data.posts.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>
              {isOwn ? (
                <>
                  <p style={{ marginBottom: 16 }}>You haven't published anything yet.</p>
                  <Link to="/new" className="btn btn-primary btn-sm">Write your first post</Link>
                </>
              ) : (
                <p>No posts yet.</p>
              )}
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              {data.posts.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          )}
        </div>
      )}

      {/* Edit profile tab */}
      {tab === 'edit' && isOwn && (
        <div style={{ maxWidth: 520 }}>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 20 }}>
            Edit profile
          </h2>
          <form onSubmit={handleBioSave}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Bio <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({bio.length}/300)</span>
              </label>
              <textarea
                className="input"
                style={{ minHeight: 100, resize: 'vertical' }}
                placeholder="Tell the community about yourself and your research focus..."
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={300}
              />
            </div>

            {bioMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: 7, marginBottom: 14, fontSize: 13,
                background: bioMsg.startsWith('Error') ? 'rgba(224,82,82,0.1)' : 'rgba(76,175,125,0.1)',
                border: `1px solid ${bioMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)'}`,
                color: bioMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)',
              }}>
                {bioMsg}
              </div>
            )}

            <button type="submit" disabled={bioSaving} className="btn btn-primary">
              {bioSaving ? 'Saving...' : 'Save bio'}
            </button>
          </form>
        </div>
      )}

      {/* Change password tab */}
      {tab === 'password' && isOwn && (
        <div style={{ maxWidth: 400 }}>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 20 }}>
            Change password
          </h2>
          <form onSubmit={handlePasswordChange}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Current password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                required
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>New password</label>
              <input
                className="input"
                type="password"
                placeholder="Min. 8 characters"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                required minLength={8}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Confirm new password</label>
              <input
                className="input"
                type="password"
                placeholder="Repeat new password"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                required
                style={pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword ? { borderColor: 'var(--danger)' } : {}}
              />
              {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>Passwords do not match.</p>
              )}
            </div>

            {pwError && (
              <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid var(--danger)', borderRadius: 7, padding: '10px 14px', marginBottom: 14, color: 'var(--danger)', fontSize: 13 }}>
                {pwError}
              </div>
            )}
            {pwMsg && (
              <div style={{ background: 'rgba(76,175,125,0.1)', border: '1px solid var(--success)', borderRadius: 7, padding: '10px 14px', marginBottom: 14, color: 'var(--success)', fontSize: 13 }}>
                {pwMsg}
              </div>
            )}

            <button type="submit" disabled={pwSaving} className="btn btn-primary">
              {pwSaving ? 'Updating...' : 'Change password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
