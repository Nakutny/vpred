import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { posts as postsApi, comments as commentsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';

const DRAFT_KEY = 'vpred_post_draft';

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

function StatBox({ label, val, color }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 120, padding: '20px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || 'var(--text)' }}>{val}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [myPosts, setMyPosts]     = useState([]);
  const [myComments, setMyComments] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('posts');
  const [localDraft, setLocalDraft] = useState(null);

  // Load local draft from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setLocalDraft(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      postsApi.list({ author: user.username, limit: 50 }),
      commentsApi.list('mine'),
    ]).then(([pRes, cRes]) => {
      setMyPosts(pRes.posts || []);
      setMyComments(cRes.comments || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  if (!user) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Bitte einloggen.</div>;

  const totalViews = myPosts.reduce((s, p) => s + (p.view_count || 0), 0);
  const totalVotes = myPosts.reduce((s, p) => s + (p.vote_count || 0), 0);
  const published = myPosts.filter(p => p.status === 'published').length;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36 }}>
        <Avatar avatarUrl={user.avatar_url} username={user.username} size={64} />
        <div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 4 }}>
            Welcome, {user.username}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Your personal dashboard</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <Link to="/new" className="btn btn-primary btn-sm">+ New Post</Link>
          <Link to={`/profile/${user.username}`} className="btn btn-ghost btn-sm">My Profile</Link>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 36, flexWrap: 'wrap' }}>
          <StatBox label="Posts" val={myPosts.length} />
          <StatBox label="Published" val={published} color="var(--success)" />
          <StatBox label="Total Views" val={totalViews} color="var(--accent)" />
          <StatBox label="Votes" val={totalVotes} />
          <StatBox label="Comments written" val={myComments.length} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {[
          { key: 'posts',    label: `My Posts (${myPosts.length})` },
          { key: 'comments', label: `My Comments (${myComments.length})` },
          { key: 'drafts',   label: `Drafts${localDraft ? ' (1)' : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? 'var(--text)' : 'var(--muted)', marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Laden…</div>
      ) : tab === 'drafts' ? (
        <div>
          {!localDraft ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)' }}>
              No saved drafts. Start writing a post and it will auto-save here.
            </div>
          ) : (
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Auto-saved draft
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {localDraft.title || '(Untitled)'}
                  </div>
                  {localDraft.summary && (
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {localDraft.summary}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {localDraft.savedAt ? `Saved ${new Date(localDraft.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Saved locally'}
                    {localDraft.erdData?.nodes?.length ? ` · ERD: ${localDraft.erdData.nodes.length} entities` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  <button
                    onClick={() => navigate('/new')}
                    className="btn btn-primary btn-sm"
                  >
                    Resume draft
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Discard this draft? This cannot be undone.')) {
                        localStorage.removeItem(DRAFT_KEY);
                        setLocalDraft(null);
                      }
                    }}
                    style={{
                      padding: '5px 12px', borderRadius: 8,
                      border: '1px solid var(--danger)', background: 'transparent',
                      color: 'var(--danger)', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : tab === 'posts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myPosts.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)' }}>
              No posts yet. <Link to="/new" style={{ color: 'var(--accent)' }}>Write your first post →</Link>
            </div>
          )}
          {myPosts.map(p => (
            <div key={p.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                    background: p.status === 'published' ? 'rgba(76,175,125,0.12)' : 'rgba(224,82,82,0.1)',
                    color: p.status === 'published' ? 'var(--success)' : 'var(--danger)',
                  }}>{p.status}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.type || 'research'}</span>
                </div>
                <Link to={`/post/${p.slug}`} style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</Link>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {timeAgo(p.created_at)} · {p.view_count || 0} views · {p.vote_count || 0} votes
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link to={`/edit/${p.id}`} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text)', textDecoration: 'none' }}>Edit</Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myComments.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)' }}>No comments yet.</div>
          )}
          {myComments.map(c => (
            <div key={c.id} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>{c.content}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                on{' '}
                {c.post_slug ? (
                  <Link to={`/post/${c.post_slug}`} style={{ color: 'var(--accent)' }}>{c.post_title || 'post'}</Link>
                ) : 'deleted post'}
                {' · '}{timeAgo(c.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
