import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { posts, categories } from '../lib/api';
import PostCard from '../components/PostCard';

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [postList, setPostList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    categories.list().then(d => setCategoryList(d.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 15 };
    if (search) params.search = search;
    if (category) params.category = category;

    posts.list(params)
      .then(d => {
        setPostList(d.posts || []);
        setPagination(d.pagination);
      })
      .catch(() => setPostList([]))
      .finally(() => setLoading(false));
  }, [search, category, page]);

  function setCategory(slug) {
    const p = new URLSearchParams();
    if (slug) p.set('category', slug);
    setSearchParams(p);
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'flex', gap: 40 }}>
      {/* Main feed */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          {search ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', fontWeight: 400 }}>
                Results for "{search}"
              </h1>
              <button onClick={() => setSearchParams({})} className="btn btn-ghost btn-sm">Clear</button>
            </div>
          ) : category ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', fontWeight: 400 }}>
                {categoryList.find(c => c.slug === category)?.name || category}
              </h1>
              <button onClick={() => setSearchParams({})} className="btn btn-ghost btn-sm">All posts</button>
            </div>
          ) : (
            <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', fontWeight: 400 }}>
              Latest Research
            </h1>
          )}
        </div>

        {/* Posts */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
          ) : postList.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)', marginBottom: 16 }}>
                {search ? 'No posts found for this search.' : 'No posts yet. Be the first to publish.'}
              </div>
              <Link to="/new" className="btn btn-primary btn-sm">Write a post</Link>
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
        {/* About */}
        <div className="card" style={{ padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 20h18L12 2z" fill="var(--accent)"/>
            </svg>
            <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1rem' }}>vpred.org</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            Open Research Collective. Investigative citizen journalism based on publicly available information.
          </p>
          <Link to="/register" className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
            Join the collective
          </Link>
        </div>

        {/* Categories */}
        {categoryList.length > 0 && (
          <div className="card" style={{ padding: '18px 20px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Categories
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                onClick={() => setCategory('')}
                style={{
                  textAlign: 'left', padding: '6px 10px', borderRadius: 6,
                  background: !category ? 'var(--surface2)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: !category ? 'var(--text)' : 'var(--muted)',
                  fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>All</span>
              </button>
              {categoryList.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.slug)}
                  style={{
                    textAlign: 'left', padding: '6px 10px', borderRadius: 6,
                    background: category === c.slug ? 'var(--surface2)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    color: category === c.slug ? 'var(--text)' : 'var(--muted)',
                    fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>{c.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.post_count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
            All content is based on publicly available sources. Authors are responsible for their claims. vpred.org does not provide legal advice.
          </p>
        </div>
      </aside>
    </div>
  );
}
