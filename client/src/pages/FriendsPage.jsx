import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { friendships } from '../lib/api';
import Avatar from '../components/Avatar';

export default function FriendsPage() {
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  async function load() {
    try {
      const res = await friendships.list();
      setData(res);
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
      await friendships.respond(id, status);
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
      await friendships.remove(id);
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
      await friendships.remove(id);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading('');
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center text-[var(--color-muted)]">
      Loading…
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">
      <h1 className="text-3xl font-serif text-[var(--color-text)]">Friends</h1>

      {error && <p className="text-red-500">{error}</p>}

      {/* Incoming requests */}
      {data.incoming.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Incoming Requests ({data.incoming.length})
          </h2>
          <div className="space-y-3">
            {data.incoming.map(req => (
              <div key={req.id} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <Link to={`/profile/${req.requester_username}`}>
                  <Avatar src={req.requester_avatar} username={req.requester_username} size={44} />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${req.requester_username}`} className="font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]">
                    {req.requester_username}
                  </Link>
                  <p className="text-xs text-[var(--color-muted)]">
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(req.id, 'accepted')}
                    disabled={actionLoading === req.id}
                    className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(req.id, 'declined')}
                    disabled={actionLoading === req.id}
                    className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] text-sm hover:text-[var(--color-text)] disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Outgoing requests */}
      {data.outgoing.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Sent Requests ({data.outgoing.length})
          </h2>
          <div className="space-y-3">
            {data.outgoing.map(req => (
              <div key={req.id} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <Link to={`/profile/${req.addressee_username}`}>
                  <Avatar src={req.addressee_avatar} username={req.addressee_username} size={44} />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${req.addressee_username}`} className="font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]">
                    {req.addressee_username}
                  </Link>
                  <p className="text-xs text-[var(--color-muted)]">Pending…</p>
                </div>
                <button
                  onClick={() => cancel(req.id)}
                  disabled={actionLoading === req.id}
                  className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] text-sm hover:text-red-500 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends list */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
          My Friends ({data.friends.length})
        </h2>
        {data.friends.length === 0 ? (
          <p className="text-[var(--color-muted)] text-sm">
            No friends yet. Visit someone's profile to send a request.
          </p>
        ) : (
          <div className="space-y-3">
            {data.friends.map(f => (
              <div key={f.id} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <Link to={`/profile/${f.friend_username}`}>
                  <Avatar src={f.friend_avatar} username={f.friend_username} size={44} />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${f.friend_username}`} className="font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]">
                    {f.friend_username}
                  </Link>
                  {f.friend_bio && (
                    <p className="text-xs text-[var(--color-muted)] truncate">{f.friend_bio}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/chat/${f.friend_id}`}
                    className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90"
                  >
                    Message
                  </Link>
                  <button
                    onClick={() => remove(f.id)}
                    disabled={actionLoading === f.id}
                    className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] text-sm hover:text-red-500 disabled:opacity-50"
                  >
                    Unfriend
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
