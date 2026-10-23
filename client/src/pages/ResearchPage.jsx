import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { posts, categories } from '../lib/api';
import PostCard from '../components/PostCard';

export default function ResearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [postList, setPostList] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [totalCount, setTotalCount] = useState(null);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    setLoading(true);
    // First get the research category slug, then load posts
    categories.list()
      .then(d => {
        const cats = d.categories || [];
        const researchCat = cats.find(c =>
          c.slug === 'research' || c.name.toLowerCase() === 'research'
        );
        return posts.list({ page, limit: 15, category: researchCat?.slug || 'research' });
      })
      .then(d => {
        setPostList(d.posts || []);
        setPagination(d.pagination);
        setTotalCount(d.pagination?.total ?? null);
      })
      .catch(() => setPostList([]))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'flex', gap: 40 }}>
      {/* Main */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', fontWeight: 400 }}>
            Research
          </h1>
          {totalCount !== null && (
            <span style={{
              fontSize: 13, color: 'var(--muted)',
              background: 'var(--surface2)', borderRadius: 20,
              padding: '2px 10px', border: '1px solid var(--border)',
            }}>
              {totalCount}
            </span>
          )}
        </div>

        {/* Posts */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
          ) : postList.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)', marginBottom: 16 }}>
                No research posts yet. Be the first to publish.
              </div>
              <Link to="/new" className="btn btn-primary btn-sm">Write research</Link>
            </div>
          ) : (
            postList.map(p => <PostCard key={p.id} post={p} />)
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => {
                  const np = new URLSearchParams(searchParams);
                  np.set('page', p);
                  setSearchParams(np);
                }}
                className="btn btn-ghost btn-sm"
                style={p === page ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside style={{ width: 260, flexShrink: 0 }}>
        <div className="card" style={{ padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1rem' }}>Research</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            In-depth research, analysis, and investigative pieces. ER diagrams, essays and data-driven investigations based on publicly available information.
          </p>
          <Link to="/new" className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
            Publish research
          </Link>
        </div>

        <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
            All research is based on publicly available sources. Authors are responsible for their claims.
          </p>
        </div>
      </aside>
    </div>
  );
}
