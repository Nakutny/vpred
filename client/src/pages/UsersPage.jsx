import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { users as usersApi, friendships as friendshipsApi } from '../lib/api';
import Avatar from '../components/Avatar';

export default function UsersPage() {
  const { user } = useAuth();
  const [userList, setUserList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [friendStatuses, setFriendStatuses] = useState({}); // userId -> {status, friendshipId, iRequested}
  const [actionLoading, setActionLoading] = useState('');

  async function load(q = '') {
    setLoading(true);
    try {
      const res = await usersApi.list(q);
      setUserList(res.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadStatuses(list) {
    if (!user || list.length === 0) return;
    const statuses = {};
    await Promise.all(
      list
        .filter(u => u.id !== user.id)
        .map(async (u) => {
          try {
            const res = await friendshipsApi.status(u.id);
            statuses[u.id] = res;
          } catch {}
        })
    );
    setFriendStatuses(statuses);
  }

  useEffect(() => {
    load('');
  }, []);

  useEffect(() => {
    loadStatuses(userList);
  }, [userList, user]);

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput.trim());
    load(searchInput.trim());
  }

  async function sendRequest(targetId) {
    setActionLoading(targetId);
    try {
      await friendshipsApi.send(targetId);
      setFriendStatuses(prev => ({
        ...prev,
        [targetId]: { status: 'pending', iRequested: true },
      }));
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading('');
    }
  }

  async function cancelRequest(targetId, friendshipId) {
    setActionLoading(targetId);
    try {
      await friendshipsApi.remove(friendshipId);
      setFriendStatuses(prev => ({
        ...prev,
        [targetId]: { status: 'none' },
      }));
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading('');
    }
  }

  function FriendButton({ targetUser }) {
    if (!user || targetUser.id === user.id) return null;
    const fs = friendStatuses[targetUser.id];
    const loading = actionLoading === targetUser.id;

    if (!fs || fs.status === 'none') {
      return (
        <button
          onClick={() => sendRequest(targetUser.id)}
          disabled={loading}
          style={{
            padding: '6px 14px', borderRadius: 8,
            background: 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
            opacity: loading ? 0.5 : 1, flexShrink: 0,
          }}
        >
          {loading ? '…' : '+ Add Friend'}
        </button>
      );
    }

    if (fs.status === 'accepted') {
      return (
        <Link
          to={`/chat/${targetUser.id}`}
          style={{
            padding: '6px 14px', borderRadius: 8,
            background: 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 500, textDecoration: 'none', flexShrink: 0,
          }}
        >
          Message
        </Link>
      );
    }

    if (fs.status === 'pending' && fs.iRequested) {
      return (
        <button
          onClick={() => cancelRequest(targetUser.id, fs.friendshipId)}
          disabled={loading}
          style={{
            padding: '6px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
            opacity: loading ? 0.5 : 1, flexShrink: 0,
          }}
        >
          {loading ? '…' : 'Request sent'}
        </button>
      );
    }

    if (fs.status === 'pending' && !fs.iRequested) {
      return (
        <Link
          to="/friends"
          style={{
            padding: '6px 14px', borderRadius: 8,
            background: 'rgba(79,142,247,0.12)', color: 'var(--accent)',
            fontSize: 13, fontWeight: 500, textDecoration: 'none', flexShrink: 0,
          }}
        >
          Respond
        </Link>
      );
    }

    return null;
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 6 }}>
        Users
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
        Discover members of the vpred.org community.
      </p>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Search by username…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0 20px' }}>
          Search
        </button>
        {search && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setSearchInput(''); setSearch(''); load(''); }}
          >
            Clear
          </button>
        )}
      </form>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>Loading…</div>
      ) : userList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          {search ? `No users found for "${search}".` : 'No users yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {userList.map(u => (
            <div
              key={u.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 12,
                border: '1px solid var(--border)', background: 'var(--surface)',
              }}
            >
              <Link to={`/profile/${u.username}`} style={{ flexShrink: 0 }}>
                <Avatar avatarUrl={u.avatar_url} username={u.username} size={44} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  to={`/profile/${u.username}`}
                  style={{ fontWeight: 500, fontSize: 15, color: 'var(--text)', display: 'block' }}
                  onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.target.style.color = 'var(--text)'}
                >
                  {u.username}
                </Link>
                {u.bio ? (
                  <p style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {u.bio}
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Member since {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
              <FriendButton targetUser={u} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
