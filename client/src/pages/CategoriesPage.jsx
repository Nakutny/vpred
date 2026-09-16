import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { categories } from '../lib/api';

export default function CategoriesPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categories.list().then(d => setList(d.categories || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 8 }}>Categories</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>Browse research by topic.</p>

      {loading ? (
        <div style={{ color: 'var(--muted)' }}>Loading...</div>
      ) : list.length === 0 ? (
        <div style={{ color: 'var(--muted)' }}>No categories yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {list.map(c => (
            <Link key={c.id} to={`/?category=${c.slug}`} className="card" style={{ padding: '20px 22px', display: 'block', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', fontWeight: 400, marginBottom: 6 }}>{c.name}</div>
              {c.description && <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{c.description}</p>}
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}>{c.post_count} posts →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
