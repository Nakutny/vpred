import { Link } from 'react-router-dom';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

function readTime(content) {
  if (!content) return null;
  const text = content.replace(/<[^>]*>/g, '');
  const words = text.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

export default function PostCard({ post }) {
  return (
    <article
      style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Vote count */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40, paddingTop: 2 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
          <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 500, marginTop: 2 }}>
            {post.vote_count || 0}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {post.category_name && (
              <Link to={`/?category=${post.category_slug}`} className="tag">
                {post.category_name}
              </Link>
            )}
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              by{' '}
              <Link
                to={`/profile/${post.author_username}`}
                style={{ color: 'var(--text)', fontWeight: 500 }}
                onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                onMouseLeave={e => e.target.style.color = 'var(--text)'}
              >
                {post.author_username}
              </Link>
            </span>
            <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{timeAgo(post.created_at)}</span>
            {readTime(post.summary || post.content) && (
              <>
                <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{readTime(post.summary || post.content)}</span>
              </>
            )}
          </div>

          {/* Title */}
          <Link to={`/post/${post.slug}`}>
            <h2 style={{
              fontFamily: 'DM Serif Display, serif',
              fontSize: '1.15rem',
              fontWeight: 400,
              color: 'var(--text)',
              marginBottom: 6,
              lineHeight: 1.3,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--accent)'}
            onMouseLeave={e => e.target.style.color = 'var(--text)'}
            >
              {post.title}
            </h2>
          </Link>

          {/* Summary */}
          {post.summary && (
            <p style={{
              color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 12,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {post.summary}
            </p>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link to={`/post/${post.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 13 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {post.comment_count || 0} comments
            </Link>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 13 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              {post.view_count || 0} views
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
