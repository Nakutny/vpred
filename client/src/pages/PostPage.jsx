import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { posts, comments as commentsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

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
  if (!content) return '1 min read';
  const text = content.replace(/<[^>]*>/g, '');
  const words = text.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

export default function PostPage() {
  const { slug } = useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [commentList, setCommentList] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [voted, setVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    posts.get(slug)
      .then(d => {
        setPost(d.post);
        setVoted(d.post.userVoted);
        setVoteCount(parseInt(d.post.vote_count) || 0);
        return commentsApi.list(d.post.id);
      })
      .then(d => setCommentList(d.comments || []))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleVote() {
    if (!user) return navigate('/login');
    try {
      const d = await posts.vote(post.id);
      setVoted(d.voted);
      setVoteCount(v => d.voted ? v + 1 : v - 1);
    } catch {}
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const d = await commentsApi.create({
        content: commentText.trim(),
        post_id: post.id,
        parent_id: replyTo || undefined,
      });
      setCommentList(prev => [...prev, d.comment]);
      setCommentText('');
      setReplyTo(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteComment(id) {
    if (!confirm('Remove this comment?')) return;
    try {
      await commentsApi.delete(id);
      setCommentList(prev => prev.map(c => c.id === id ? { ...c, is_removed: true, content: '[Comment removed]' } : c));
    } catch {}
  }

  async function handleDeletePost() {
    if (!confirm('Permanently remove this post?')) return;
    try {
      await posts.delete(post.id);
      navigate('/');
    } catch {}
  }

  function buildTree(comments) {
    const map = {};
    const roots = [];
    comments.forEach(c => { map[c.id] = { ...c, replies: [] }; });
    comments.forEach(c => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].replies.push(map[c.id]);
      else roots.push(map[c.id]);
    });
    return roots;
  }

  function CommentNode({ comment, depth = 0 }) {
    return (
      <div style={{ marginLeft: depth > 0 ? 28 : 0, borderLeft: depth > 0 ? '2px solid var(--border)' : 'none', paddingLeft: depth > 0 ? 16 : 0 }}>
        <div style={{ padding: '14px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Link to={`/profile/${comment.author_username}`} style={{
              width: 26, height: 26, borderRadius: '50%', background: 'var(--surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: 'var(--accent)', flexShrink: 0,
            }}>
              {comment.author_username?.[0]?.toUpperCase() || '?'}
            </Link>
            <Link to={`/profile/${comment.author_username}`} style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}
              onMouseEnter={e => e.target.style.color = 'var(--accent)'}
              onMouseLeave={e => e.target.style.color = 'var(--text)'}
            >
              {comment.author_username || 'Unknown'}
            </Link>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{timeAgo(comment.created_at)}</span>
            {(isAdmin || user?.id === comment.author_id) && !comment.is_removed && (
              <button onClick={() => handleDeleteComment(comment.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}>
                Remove
              </button>
            )}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: comment.is_removed ? 'var(--muted)' : 'var(--text)', fontStyle: comment.is_removed ? 'italic' : 'normal' }}>
            {comment.content}
          </p>
          {user && !comment.is_removed && (
            <button onClick={() => setReplyTo(comment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
              Reply
            </button>
          )}
          {replyTo === comment.id && (
            <div style={{ marginTop: 12 }}>
              <textarea
                className="input"
                style={{ minHeight: 80, resize: 'vertical', marginBottom: 8 }}
                placeholder="Write a reply..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleComment} disabled={submitting} className="btn btn-primary btn-sm">
                  {submitting ? 'Posting...' : 'Post reply'}
                </button>
                <button onClick={() => setReplyTo(null)} className="btn btn-ghost btn-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
        {comment.replies?.map(r => <CommentNode key={r.id} comment={r} depth={depth + 1} />)}
        {depth === 0 && <hr className="divider" />}
      </div>
    );
  }

  if (loading) return (
    <div style={{ maxWidth: 820, margin: '60px auto', padding: '0 24px', color: 'var(--muted)' }}>Loading...</div>
  );

  if (!post) return null;

  const tree = buildTree(commentList);
  const canEdit = isAdmin || user?.id === post.author_id;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px' }}>
      {/* Back */}
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to feed
      </Link>

      {/* Disclaimer */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', marginBottom: 28, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <svg style={{ marginTop: 2, flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          This post represents the author's personal research based on publicly available information. Not legal advice.
        </span>
      </div>

      <article>
        {/* Category */}
        {post.category_name && (
          <Link to={`/?category=${post.category_slug}`} className="tag" style={{ marginBottom: 14, display: 'inline-flex' }}>
            {post.category_name}
          </Link>
        )}

        {/* Title */}
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 400, lineHeight: 1.2, marginBottom: 20 }}>
          {post.title}
        </h1>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, flexWrap: 'wrap', paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
          {/* Author */}
          <Link to={`/profile/${post.author_username}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 600, color: '#fff', flexShrink: 0,
            }}>
              {post.author_username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}
                onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                onMouseLeave={e => e.target.style.color = 'var(--text)'}
              >
                {post.author_username}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6 }}>
                <span>{timeAgo(post.created_at)}</span>
                <span>·</span>
                <span>{readTime(post.content)}</span>
              </div>
            </div>
          </Link>

          {/* Actions */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{post.view_count} views</span>

            {/* Vote */}
            <button
              onClick={handleVote}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 7, border: '1px solid',
                borderColor: voted ? 'var(--accent)' : 'var(--border)',
                background: voted ? 'rgba(79,142,247,0.1)' : 'transparent',
                color: voted ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
              {voteCount} upvotes
            </button>

            {/* Edit (admin or author) */}
            {canEdit && (
              <Link to={`/post/${post.slug}/edit`} className="btn btn-ghost btn-sm">
                Edit post
              </Link>
            )}

            {/* Delete (admin or author) */}
            {canEdit && (
              <button onClick={handleDeletePost} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="prose" dangerouslySetInnerHTML={{ __html: post.content }} style={{ maxWidth: '100%' }} />
      </article>

      {/* Comments */}
      <section style={{ marginTop: 56 }}>
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.4rem', fontWeight: 400, marginBottom: 24 }}>
          {commentList.filter(c => !c.is_removed).length} Comments
        </h2>

        {user ? (
          !replyTo && (
            <div style={{ marginBottom: 32 }}>
              <textarea
                className="input"
                style={{ minHeight: 100, resize: 'vertical', marginBottom: 10 }}
                placeholder="Share your thoughts..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
              />
              {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
              <button onClick={handleComment} disabled={submitting || !commentText.trim()} className="btn btn-primary btn-sm">
                {submitting ? 'Posting...' : 'Post comment'}
              </button>
            </div>
          )
        ) : (
          <div style={{ padding: '16px 20px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 28 }}>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>
              <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link> to join the discussion.
            </span>
          </div>
        )}

        <div>
          {tree.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No comments yet.</p>
          ) : (
            tree.map(c => <CommentNode key={c.id} comment={c} />)
          )}
        </div>
      </section>
    </div>
  );
}
