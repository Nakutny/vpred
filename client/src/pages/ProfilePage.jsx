import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { profile as profileApi, friendships as friendshipsApi, blocks as blocksApi, donate as donateApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import { UsernameWithColor } from '../components/DonatorBadge';

const PRESET_AVATARS = [
  { id: 'banknote', url: '/avatars/banknote.svg' },
  { id: 'lambo', url: '/avatars/lambo.svg' },
  { id: 'watch', url: '/avatars/watch.svg' },
  { id: 'chain', url: '/avatars/chain.svg' },
  { id: 'vault', url: '/avatars/vault.svg' },
  { id: 'question', url: '/avatars/question.svg' },
  { id: 'cigarette', url: '/avatars/cigarette.svg' },
];


export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const [savedAvatar, setSavedAvatar] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [avatarMsg, setAvatarMsg] = useState('');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Friendship / Block state (for other user's profile)
  const [friendship, setFriendship] = useState({ status: 'none', friendshipId: null, iRequested: false });
  const [blocked, setBlocked] = useState(false); // I blocked them
  const [socialLoading, setSocialLoading] = useState(false);

  // Donator settings
  const [donatorColor, setDonatorColor] = useState('');  // '' = default/reset, '#RRGGBB' = custom
  const [badgeVisible, setBadgeVisible] = useState(true);
  const [donatorMsg, setDonatorMsg] = useState('');
  const [donatorSaving, setDonatorSaving] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);

  const isOwn = user?.username?.toLowerCase() === username?.toLowerCase();

  useEffect(() => {
    setLoading(true);
    setError('');
    setData(null);
    setFriendship({ status: 'none', friendshipId: null, iRequested: false });
    setBlocked(false);
    profileApi.get(username)
      .then(d => {
        setData(d);
        setBio(d.user.bio || '');
        setSavedAvatar(d.user.avatar_url || null);
        setSelectedAvatar(d.user.avatar_url || null);
        setProfileUserId(d.user.id);
        setDonatorColor(d.user.donator_color || '');
        setBadgeVisible(d.user.donator_badge_visible !== false);
      })
      .catch(err => setError(err.message || 'Failed to load profile.'))
      .finally(() => setLoading(false));
  }, [username]);

  // Load friendship + block status once we have the profile user's id
  useEffect(() => {
    if (!user || isOwn || !profileUserId) return;

    async function loadSocial() {
      try {
        const [frRes, blRes] = await Promise.all([
          friendshipsApi.status(profileUserId),
          blocksApi.list(),
        ]);
        setFriendship(frRes);
        const isBlocked = blRes.blocks.some(b => b.blocked_id === profileUserId);
        setBlocked(isBlocked);
      } catch {}
    }
    loadSocial();
  }, [user, isOwn, profileUserId]);

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

  async function handleSaveAvatar() {
    setAvatarSaving(true);
    try {
      await profileApi.updateAvatar(selectedAvatar);
      setSavedAvatar(selectedAvatar);
      setData(d => ({ ...d, user: { ...d.user, avatar_url: selectedAvatar } }));
      flash(setAvatarMsg, 'Avatar saved!');
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
    reader.onload = (ev) => setSelectedAvatar(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // Social actions
  async function sendFriendRequest() {
    setSocialLoading(true);
    try {
      const res = await friendshipsApi.send(profileUserId);
      setFriendship({ status: 'pending', friendshipId: res.friendship.id, iRequested: true });
    } catch (e) {
      alert(e.message);
    } finally {
      setSocialLoading(false);
    }
  }

  async function cancelFriendRequest() {
    if (!friendship.friendshipId) return;
    setSocialLoading(true);
    try {
      await friendshipsApi.remove(friendship.friendshipId);
      setFriendship({ status: 'none', friendshipId: null, iRequested: false });
    } catch (e) {
      alert(e.message);
    } finally {
      setSocialLoading(false);
    }
  }

  async function acceptFriendRequest() {
    if (!friendship.friendshipId) return;
    setSocialLoading(true);
    try {
      await friendshipsApi.respond(friendship.friendshipId, 'accepted');
      setFriendship(f => ({ ...f, status: 'accepted' }));
    } catch (e) {
      alert(e.message);
    } finally {
      setSocialLoading(false);
    }
  }

  async function unfriend() {
    if (!friendship.friendshipId || !confirm('Remove this friend?')) return;
    setSocialLoading(true);
    try {
      await friendshipsApi.remove(friendship.friendshipId);
      setFriendship({ status: 'none', friendshipId: null, iRequested: false });
    } catch (e) {
      alert(e.message);
    } finally {
      setSocialLoading(false);
    }
  }

  async function handleBlock() {
    if (!confirm(`Block ${username}? They won't be able to contact you and any friendship will be removed.`)) return;
    setSocialLoading(true);
    try {
      await blocksApi.block(profileUserId);
      setBlocked(true);
      setFriendship({ status: 'none', friendshipId: null, iRequested: false });
    } catch (e) {
      alert(e.message);
    } finally {
      setSocialLoading(false);
    }
  }

  async function handleUnblock() {
    setSocialLoading(true);
    try {
      await blocksApi.unblock(profileUserId);
      setBlocked(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSocialLoading(false);
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
      { id: 'edit', label: 'Edit Bio' },
      { id: 'password', label: 'Change password' },
      ...(data.user.is_donator ? [{ id: 'donator', label: '🎖️ Donator' }] : []),
    ] : []),
  ];

  async function handleDonatorSave() {
    setDonatorSaving(true);
    setDonatorMsg('');
    try {
      // Send null to reset, or the hex color
      await donateApi.setColor(donatorColor || null);
      await profileApi.update({ donator_badge_visible: badgeVisible });
      setDonatorMsg('Saved!');
      setTimeout(() => setDonatorMsg(''), 3000);
    } catch (err) {
      setDonatorMsg('Error: ' + (err.message || 'Could not save'));
    } finally {
      setDonatorSaving(false);
    }
  }

  async function handleColorReset() {
    setDonatorColor('');
  }

  const hasUnsavedAvatar = selectedAvatar !== savedAvatar;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 36, paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
        <Avatar avatarUrl={savedAvatar} username={data.user.username} size={72} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 4 }}>
            <UsernameWithColor user={data.user} />
          </h1>
          {data.user.bio ? (
            <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.6, maxWidth: 500, marginBottom: 10 }}>
              {data.user.bio}
            </p>
          ) : isOwn ? (
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 10, fontStyle: 'italic' }}>
              No bio yet. Add one in "Edit Bio".
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>{data.posts.length}</strong> posts
            </span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>Joined {timeAgo(data.user.created_at)}</span>

            {/* Social actions for other users */}
            {!isOwn && user && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {blocked ? (
                  <button
                    onClick={handleUnblock}
                    disabled={socialLoading}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  >
                    Unblock
                  </button>
                ) : (
                  <>
                    {friendship.status === 'none' && (
                      <button onClick={sendFriendRequest} disabled={socialLoading} className="btn btn-primary btn-sm">
                        + Add Friend
                      </button>
                    )}
                    {friendship.status === 'pending' && friendship.iRequested && (
                      <button onClick={cancelFriendRequest} disabled={socialLoading} className="btn btn-ghost btn-sm">
                        Request Sent ✓
                      </button>
                    )}
                    {friendship.status === 'pending' && !friendship.iRequested && (
                      <button onClick={acceptFriendRequest} disabled={socialLoading} className="btn btn-primary btn-sm">
                        Accept Request
                      </button>
                    )}
                    {friendship.status === 'accepted' && (
                      <>
                        <Link
                          to={`/chat/${profileUserId}`}
                          className="btn btn-primary btn-sm"
                        >
                          Message
                        </Link>
                        <button onClick={unfriend} disabled={socialLoading} className="btn btn-ghost btn-sm">
                          Friends ✓
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleBlock}
                      disabled={socialLoading}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--muted)', fontSize: 12 }}
                      title="Block user"
                    >
                      Block
                    </button>
                  </>
                )}
              </div>
            )}
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
        <div style={{ maxWidth: 580 }}>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 6 }}>
            Choose your avatar
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
            Select a preset or upload your own image. Click "Save avatar" to apply.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, padding: '20px 24px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Avatar avatarUrl={selectedAvatar} username={data.user.username} size={64} />
              {hasUnsavedAvatar && (
                <div style={{
                  position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--accent)', border: '2px solid var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                {hasUnsavedAvatar ? 'Preview — not saved yet' : 'Current avatar'}
              </div>
              {hasUnsavedAvatar && (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Click "Save avatar" to apply this change.</div>
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

          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Upload your own
            </h3>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload image (max 500KB)
            </button>
          </div>

          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Preset avatars
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 10 }}>
              {PRESET_AVATARS.map(avatar => (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(avatar.url)}
                  style={{
                    padding: '10px', borderRadius: 12, cursor: 'pointer',
                    border: selectedAvatar === avatar.url ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: selectedAvatar === avatar.url ? 'rgba(79,142,247,0.08)' : 'var(--surface)',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <img src={avatar.url} alt="" style={{ width: 60, height: 60, borderRadius: '50%' }} />
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleSaveAvatar} disabled={avatarSaving || !hasUnsavedAvatar} className="btn btn-primary" style={{ opacity: hasUnsavedAvatar ? 1 : 0.5 }}>
              {avatarSaving ? 'Saving...' : 'Save avatar'}
            </button>
            {hasUnsavedAvatar && (
              <button onClick={() => setSelectedAvatar(savedAvatar)} className="btn btn-ghost btn-sm">Cancel</button>
            )}
            {savedAvatar && (
              <button onClick={() => setSelectedAvatar(null)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>
                Reset to default
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit profile */}
      {tab === 'edit' && isOwn && (
        <div style={{ maxWidth: 520 }}>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 20 }}>Edit Bio</h2>
          <form onSubmit={handleBioSave}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Bio <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({bio.length}/300)</span>
              </label>
              <textarea
                className="input"
                style={{ minHeight: 100, resize: 'vertical' }}
                placeholder="Tell the community about yourself and your research focus (Edit Bio)..."
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

      {/* Donator settings */}
      {tab === 'donator' && isOwn && data.user.is_donator && (
        <div style={{ maxWidth: 480 }}>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 6 }}>
            Donator Settings
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Thank you for supporting Vpred! Customize how your donation is displayed.
          </p>

          {/* Color picker */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Username color
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="color"
                value={donatorColor || '#7B2FBE'}
                onChange={e => setDonatorColor(e.target.value)}
                style={{
                  width: 48, height: 48, border: '2px solid var(--border)',
                  borderRadius: 8, cursor: 'pointer', background: 'none', padding: 2,
                }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: donatorColor || 'var(--text)' }}>
                  {data.user.username}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {donatorColor ? 'Custom color active' : 'Default color (no color set)'}
                </div>
              </div>
              {donatorColor && (
                <button
                  type="button"
                  onClick={handleColorReset}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: 'var(--muted)' }}
                >
                  Reset to default
                </button>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Click the color swatch to pick a color. Click "Reset to default" to remove your custom color.
            </p>
          </div>

          {/* Badge toggle */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Donator badge visibility
            </label>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 16px',
            }}>
              <input
                type="checkbox"
                checked={badgeVisible}
                onChange={e => setBadgeVisible(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Show Donator badge</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {badgeVisible
                    ? 'Your badge is visible on posts and your profile'
                    : 'Your badge is hidden — only you can see this setting'}
                </div>
              </div>
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '2px 6px',
                borderRadius: 4, background: '#7B2FBE22', color: '#7B2FBE',
                border: '1px solid #7B2FBE44',
              }}>Donator</span>
            </label>
          </div>

          {donatorMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: 7, marginBottom: 14, fontSize: 13,
              background: donatorMsg.startsWith('Error') ? 'rgba(224,82,82,0.1)' : 'rgba(76,175,125,0.1)',
              border: `1px solid ${donatorMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)'}`,
              color: donatorMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)',
            }}>
              {donatorMsg}
            </div>
          )}

          <button onClick={handleDonatorSave} disabled={donatorSaving} className="btn btn-primary">
            {donatorSaving ? 'Saving…' : 'Save settings'}
          </button>
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
