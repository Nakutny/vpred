import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { profile as profileApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import PostCard from '../components/PostCard';

const PRESET_AVATARS = [
  { id: 'banknote', label: 'Banknote', url: '/avatars/banknote.svg' },
  { id: 'lambo', label: 'Lambo', url: '/avatars/lambo.svg' },
  { id: 'watch', label: 'Watch', url: '/avatars/watch.svg' },
  { id: 'chain', label: 'Chain', url: '/avatars/chain.svg' },
  { id: 'vault', label: 'Vault', url: '/avatars/vault.svg' },
  { id: 'question', label: 'Mystery', url: '/avatars/question.svg' },
  { id: 'cigarette', label: 'Cigarette', url: '/avatars/cigarette.svg' },
];

function Avatar({ url, username, size = 72 }) {
  if (url) {
    return (
      <img
        src={url}
        alt={username}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--border)' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, color: '#fff',
    }}>
      {username?.[0]?.toUpperCase()}
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('posts');

  // Bio
  const [bio, setBio] = useState('');
  const [bioMsg, setBioMsg] = useState('');
  const [bioSaving, setBioSaving] = useState(false);

  // Password
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Avatar
  const [avatarMsg, setAvatarMsg] = useState('');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState(null);
  const fileInputRef = useRef(null);

  const isOwn = user?.username?.toLowerCase() === username?.toLowerCase();

  useEffect(() => {
    setLoading(true);
    setError('');
    setData(null);
    profileApi.get(username)
      .then(d => {
        setData(d);
        setBio(d.user.bio || '');
        setCurrentAvatar(d.user.avatar_url || null);
      })
      .catch(err => setError(err.message || 'Failed to load profile.'))
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
    if (pwForm.newPassword !== pwForm.confirmPassword) return setPwError('Passwords do not match.');
    setPwSaving(true);
    try {
      await profileApi.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      flash(setPwMsg, 'Password changed successfully.');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  }

  async function handleSetAvatar(url) {
    setAvatarSaving(true);
    try {
      await profileApi.updateAvatar(url);
      setCurrentAvatar(url);
      setData(d => ({ ...d, user: { ...d.user, avatar_url: url } }));
      flash(setAvatarMsg, 'Avatar updated.');
    } catch (err) {
      flash(setAvatarMsg, 'Error: ' + err.message);
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return flash(setAvatarMsg, 'Please select an image file.');
    if (file.size > 500 * 1024) return flash(setAvatarMsg, 'Image too large. Max 500KB.');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      await handleSetAvatar(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleRemoveAvatar() {
    await handleSetAvatar(null);
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days > 30) return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (days > 0) return `${days}d ago`;
    return 'today';
  }

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '60px auto', padding: '0 24px', color: 'var(--muted)', fontSize: 14 }}>
      Loading profile...
    </div>
  );

  if (error) return (
    <div style={{ maxWidth: 900, margin: '60px auto', padding: '0 24px' }}>
      <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 16 }}>{error}</div>
      <Link to="/" className="btn btn-ghost btn-sm">← Back to feed</Link>
    </div>
  );

  if (!data) return null;

  const tabs = [
    { id: 'posts', label: `Posts (${data.posts.length})` },
    ...(isOwn ? [
      { id: 'avatar', label: 'Avatar' },
      { id: 'edit', label: 'Edit profile' },
      { id: 'password', label: 'Change password' },
    ] : []),
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 36, paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
        <Avatar url={data.user.avatar_url} username={data.user.username} size={72} />
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
              No bio yet. Add one in "Edit profile".
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 20 }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>{data.posts.length}</strong> posts
            </span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>Joined {timeAgo(data.user.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 28, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? 'var(--text)' : 'var(--muted)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {tab === 'posts' && (
        <div>
          {data.posts.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>
              {isOwn ? (
                <><p style={{ marginBottom: 16 }}>You haven't published anything yet.</p>
                <Link to="/new" className="btn btn-primary btn-sm">Write your first post</Link></>
              ) : <p>No posts yet.</p>}
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              {data.posts.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          )}
        </div>
      )}

      {/* Avatar tab */}
      {tab === 'avatar' && isOwn && (
        <div style={{ maxWidth: 560 }}>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 20 }}>
            Choose your avatar
          </h2>

          {/* Current avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, padding: '16px 20px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <Avatar url={currentAvatar} username={data.user.username} size={56} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Current avatar</div>
              {currentAvatar && (
                <button onClick={handleRemoveAvatar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13 }}>
                  Remove avatar
                </button>
              )}
            </div>
          </div>

          {avatarMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: 7, marginBottom: 20, fontSize: 13,
              background: avatarMsg.startsWith('Error') ? 'rgba(224,82,82,0.1)' : 'rgba(76,175,125,0.1)',
              border: `1px solid ${avatarMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)'}`,
              color: avatarMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)',
            }}>
              {avatarMsg}
            </div>
          )}

          {/* Upload own */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Upload your own
            </h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarSaving}
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {avatarSaving ? 'Uploading...' : 'Upload image (max 500KB)'}
            </button>
          </div>

          {/* Preset avatars */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Choose a preset
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
              {PRESET_AVATARS.map(avatar => (
                <button
                  key={avatar.id}
                  onClick={() => handleSetAvatar(avatar.url)}
                  disabled={avatarSaving}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                    border: currentAvatar === avatar.url ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: currentAvatar === avatar.url ? 'rgba(79,142,247,0.08)' : 'var(--surface)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (currentAvatar !== avatar.url) e.currentTarget.style.borderColor = '#3a3f55'; }}
                  onMouseLeave={e => { if (currentAvatar !== avatar.url) e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <img src={avatar.url} alt={avatar.label} style={{ width: 52, height: 52, borderRadius: '50%' }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{avatar.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit profile */}
      {tab === 'edit' && isOwn && (
        <div style={{ maxWidth: 520 }}>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 20 }}>Edit profile</h2>
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

      {/* Change password */}
      {tab === 'password' && isOwn && (
        <div style={{ maxWidth: 400 }}>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 20 }}>Change password</h2>
          <form onSubmit={handlePasswordChange}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Current password</label>
              <input className="input" type="password" placeholder="••••••••" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>New password</label>
              <input className="input" type="password" placeholder="Min. 8 characters" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required minLength={8} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Confirm new password</label>
              <input className="input" type="password" placeholder="Repeat new password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} required
                style={pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword ? { borderColor: 'var(--danger)' } : {}} />
              {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>Passwords do not match.</p>
              )}
            </div>
            {pwError && <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid var(--danger)', borderRadius: 7, padding: '10px 14px', marginBottom: 14, color: 'var(--danger)', fontSize: 13 }}>{pwError}</div>}
            {pwMsg && <div style={{ background: 'rgba(76,175,125,0.1)', border: '1px solid var(--success)', borderRadius: 7, padding: '10px 14px', marginBottom: 14, color: 'var(--success)', fontSize: 13 }}>{pwMsg}</div>}
            <button type="submit" disabled={pwSaving} className="btn btn-primary">
              {pwSaving ? 'Updating...' : 'Change password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
