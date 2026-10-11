import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { posts } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';

function readingTime(content) {
  if (!content) return 1;
  const text = content.replace(/<[^>]+>/g, '');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function EssayCard({ post }) {
  const mins = readingTime(post.content || '');
  const images = Array.isArray(post.images) ? post.images : [];
  const cover = images[0] || null;

  return (
    <article style={{
      display: 'flex', flexDirection: cover ? 'row' : 'column',
      gap: 20, padding: '28px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Cover image */}
      {cover && (
        <Link to={`/post/${post.slug}`} style={{ flexShrink: 0, display: 'block', width: 160, height: 110, borderRadius: 10, overflow: 'hidden' }}>
          <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Link>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Topic tag */}
        {post.topic && (
          <span style={{
            display: 'inline-block', marginBottom: 8,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            background: 'rgba(79,142,247,0.1)',
            padding: '3px 10px', borderRadius: 20,
          }}>
            {post.topic}
          </span>
        )}

        <Link to={`/post/${post.slug}`} style={{ textDecoration: 'none' }}>
          <h2 style={{
            fontFamily: 'DM Serif Display, serif',
            fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
            fontWeight: 400, lineHeight: 1.35,
            color: 'var(--text)', marginBottom: 8,
          }}>
            {post.title}
          </h2>
        </Link>

        {post.summary && (
          <p style={{
            color: 'var(--muted)', fontSize: 14, lineHeight: 1.6,
            marginBottom: 14,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {post.summary}
          </p>
        )}

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to={`/profile/${post.author_username}`} style={{
            display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none',
          }}>
            <Avatar src={post.author_avatar} username={post.author_username} size={22} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{post.author_username}</span>
          </Link>
          <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{mins} min read</span>
          {parseInt(post.vote_count) > 0 && (
            <>
              <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>♥ {post.vote_count}</span>
            </>
          )}
          {parseInt(post.comment_count) > 0 && (
            <>
              <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>💬 {post.comment_count}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function EssaysPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ posts: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    posts.list({ type: 'essay', page, limit: 10, ...(search ? { search } : {}) })
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 400, lineHeight: 1.15, marginBottom: 10 }}>
              Essays
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 15, maxWidth: 480 }}>
              Personal writing, philosophy, and reflections — open to everyone.
            </p>
          </div>
          {user && (
            <Link to="/essays/new" className="btn btn-primary" style={{ flexShrink: 0, marginTop: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Write essay
            </Link>
          )}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="input"
                style={{ paddingLeft: 36 }}
                placeholder="Search essays…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-ghost">Search</button>
            {search && (
              <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Essays list */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
      ) : data.posts.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 20 }}>
            {search ? 'No essays found for this search.' : 'No essays published yet.'}
          </p>
          {user && !search && (
            <Link to="/essays/new" className="btn btn-primary">Write the first essay</Link>
          )}
        </div>
      ) : (
        <>
          <div>
            {data.posts.map(p => <EssayCard key={p.id} post={p} />)}
          </div>

          {/* Pagination */}
          {data.pagination && data.pagination.pages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 40 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-ghost btn-sm"
              >
                ← Previous
              </button>
              <span style={{ fontSize: 13, color: 'var(--muted)', alignSelf: 'center' }}>
                {page} / {data.pagination.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                disabled={page === data.pagination.pages}
                className="btn btn-ghost btn-sm"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
