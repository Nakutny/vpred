import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { friendships as friendshipsApi, messages as messagesApi } from '../lib/api';
import Avatar from '../components/Avatar';

export default function FriendsPage() {
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [tab, setTab] = useState('friends'); // friends | messages | requests

  async function load() {
    try {
      const [frRes, convRes] = await Promise.all([
        friendshipsApi.list(),
        messagesApi.conversations().catch(() => ({ conversations: [] })),
      ]);
      setData(frRes);
      setConversations(convRes.conversations || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function respond(id, status) {
    setActionLoading(id);
    try {
      await friendshipsApi.respond(id, status);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading('');
    }
  }

  async function remove(id) {
    if (!confirm('Remove this friend?')) return;
    setActionLoading(id);
    try {
      await friendshipsApi.remove(id);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading('');
    }
  }

  async function cancel(id) {
    setActionLoading(id);
    try {
      await friendshipsApi.remove(id);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading('');
    }
  }

  const pendingCount = data.incoming.length;
  const tabs = [
    { key: 'friends', label: `Friends (${data.friends.length})` },
    { key: 'messages', label: `Messages${conversations.length > 0 ? ` (${conversations.length})` : ''}` },
    { key: 'requests', label: `Requests${pendingCount > 0 ? ` · ${pendingCount}` : ''}`, accent: pendingCount > 0 },
  ];

  if (loading) return (
    <div style={{ maxWidth: 680, margin: '60px auto', padding: '0 24px', textAlign: 'center', color: 'var(--muted)' }}>
      Loading…
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 24 }}>
        Friends & Messages
      </h1>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</p>}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', fontSize: 14,
              fontWeight: tab === t.key ? 600 : 400,
              color: t.accent ? 'var(--accent)' : tab === t.key ? 'var(--text)' : 'var(--muted)',
              marginBottom: -1,
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* FRIENDS TAB */}
      {tab === 'friends' && (
        <section>
          {data.friends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              <p style={{ marginBottom: 8 }}>No friends yet.</p>
              <p style={{ fontSize: 13 }}>Visit someone's profile to send a friend request.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.friends.map(f => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 12,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                }}>
                  <Link to={`/profile/${f.friend_username}`} style={{ flexShrink: 0 }}>
                    <Avatar avatarUrl={f.friend_avatar} username={f.friend_username} size={44} />
                  </Link>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      to={`/profile/${f.friend_username}`}
                      style={{ fontWeight: 500, fontSize: 15, color: 'var(--text)', display: 'block' }}
                      onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.target.style.color = 'var(--text)'}
                    >
                      {f.friend_username}
                    </Link>
                    {f.friend_bio && (
                      <p style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {f.friend_bio}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link
                      to={`/chat/${f.friend_id}`}
                      style={{
                        padding: '6px 14px', borderRadius: 8,
                        background: 'var(--accent)', color: '#fff',
                        fontSize: 13, fontWeight: 500, textDecoration: 'none',
                      }}
                    >
                      Message
                    </Link>
                    <button
                      onClick={() => remove(f.id)}
                      disabled={actionLoading === f.id}
                      style={{
                        padding: '6px 14px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
                        opacity: actionLoading === f.id ? 0.5 : 1,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      Unfriend
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* MESSAGES TAB */}
      {tab === 'messages' && (
        <section>
          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              <p style={{ marginBottom: 8 }}>No conversations yet.</p>
              <p style={{ fontSize: 13 }}>Message a friend from the Friends tab.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conversations.map(conv => (
                <Link
                  key={conv.other_id}
                  to={`/chat/${conv.other_id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 12,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    textDecoration: 'none', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <Avatar avatarUrl={conv.other_avatar} username={conv.other_username} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: conv.unread_count > 0 ? 700 : 500, fontSize: 15, color: 'var(--text)', marginBottom: 3 }}>
                      {conv.other_username}
                    </div>
                    {/* FIX: use conv.content (the actual DB field returned) */}
                    {conv.content && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'lowercase' }}>
                        {conv.content}
                      </div>
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <span style={{
                      background: 'var(--accent)', color: '#fff', borderRadius: 9999,
                      fontSize: 11, fontWeight: 700, minWidth: 20, height: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 5px',
                    }}>
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                  {conv.created_at && (
                    <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                      {formatTime(conv.created_at)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* REQUESTS TAB */}
      {tab === 'requests' && (
        <section>
          {/* Incoming */}
          {data.incoming.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
                Incoming ({data.incoming.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.incoming.map(req => (
                  <div key={req.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 12,
                    border: '1px solid var(--accent)', background: 'rgba(79,142,247,0.04)',
                  }}>
                    <Link to={`/profile/${req.requester_username}`} style={{ flexShrink: 0 }}>
                      <Avatar avatarUrl={req.requester_avatar} username={req.requester_username} size={44} />
                    </Link>
                    <div style={{ flex: 1 }}>
                      <Link
                        to={`/profile/${req.requester_username}`}
                        style={{ fontWeight: 500, fontSize: 15, color: 'var(--text)' }}
                        onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                        onMouseLeave={e => e.target.style.color = 'var(--text)'}
                      >
                        {req.requester_username}
                      </Link>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => respond(req.id, 'accepted')}
                        disabled={actionLoading === req.id}
                        style={{
                          padding: '6px 14px', borderRadius: 8,
                          background: 'var(--accent)', color: '#fff',
                          fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                          opacity: actionLoading === req.id ? 0.5 : 1,
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respond(req.id, 'declined')}
                        disabled={actionLoading === req.id}
                        style={{
                          padding: '6px 14px', borderRadius: 8,
                          border: '1px solid var(--border)', background: 'transparent',
                          color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
                          opacity: actionLoading === req.id ? 0.5 : 1,
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing */}
          {data.outgoing.length > 0 && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
                Sent ({data.outgoing.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.outgoing.map(req => (
                  <div key={req.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 12,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                  }}>
                    <Link to={`/profile/${req.addressee_username}`} style={{ flexShrink: 0 }}>
                      <Avatar avatarUrl={req.addressee_avatar} username={req.addressee_username} size={44} />
                    </Link>
                    <div style={{ flex: 1 }}>
                      <Link
                        to={`/profile/${req.addressee_username}`}
                        style={{ fontWeight: 500, fontSize: 15, color: 'var(--text)' }}
                        onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                        onMouseLeave={e => e.target.style.color = 'var(--text)'}
                      >
                        {req.addressee_username}
                      </Link>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Pending…</p>
                    </div>
                    <button
                      onClick={() => cancel(req.id)}
                      disabled={actionLoading === req.id}
                      style={{
                        padding: '6px 14px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
                        opacity: actionLoading === req.id ? 0.5 : 1,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.incoming.length === 0 && data.outgoing.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              No pending requests.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
