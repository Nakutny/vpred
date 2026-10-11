import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { legal } from '../lib/api';
import SEO from '../components/SEO';

const DEFAULT_CONTENT = `<h2>About vpred.org</h2>

<p>vpred.org is an open research collective dedicated to investigative citizen journalism. All content published here is based exclusively on publicly available information — court records, official documents, news archives, and other open sources.</p>

<p>The platform exists to make research accessible, structured, and collaborative. Anyone can read. Registered members can publish research, write essays, and participate in the discussion.</p>

<h3>Our Principles</h3>
<ul>
  <li>Only publicly available sources</li>
  <li>No personal data is sold or shared with third parties</li>
  <li>Authors are responsible for their own content</li>
  <li>Nothing published here constitutes legal advice</li>
</ul>

<h3>Contact</h3>
<p>Questions, feedback, or concerns? Reach out at <a href="mailto:vpredmail@gmail.com">vpredmail@gmail.com</a></p>

<p>For legal matters, please see our <a href="/legal-notice">Legal Notice</a> and <a href="/privacy">Privacy Policy</a>.</p>`;

export default function AboutPage() {
  const { isAdmin } = useAuth();
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    legal.get('about')
      .then(d => {
        const c = d.page.content || DEFAULT_CONTENT;
        setContent(c);
        setEditContent(c);
      })
      .catch(() => {
        setContent(DEFAULT_CONTENT);
        setEditContent(DEFAULT_CONTENT);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await legal.update('about', editContent);
      setContent(editContent);
      setEditing(false);
      setMsg('About page updated.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
      <SEO title="About" description="Learn about vpred.org – an open research collective for investigative citizen journalism." url="/about" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2rem', fontWeight: 400 }}>About vpred.org</h1>
        {isAdmin && !editing && (
          <button onClick={() => { setEditing(true); setEditContent(content); }} className="btn btn-ghost btn-sm">
            Edit
          </button>
        )}
      </div>

      {msg && (
        <div style={{
          padding: '10px 16px', borderRadius: 7, marginBottom: 20, fontSize: 13,
          background: msg.startsWith('Error') ? 'rgba(224,82,82,0.1)' : 'rgba(76,175,125,0.1)',
          border: `1px solid ${msg.startsWith('Error') ? 'var(--danger)' : 'var(--success)'}`,
          color: msg.startsWith('Error') ? 'var(--danger)' : 'var(--success)',
        }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--muted)' }}>Loading...</div>
      ) : editing ? (
        <div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
            You can use plain text or basic HTML ({"<b>, <i>, <a>, <br>, <p>, <h2>, <h3>, <ul>, <li>"}).
          </p>
          <textarea
            className="input"
            style={{ minHeight: 400, resize: 'vertical', fontFamily: 'monospace', fontSize: 13, marginBottom: 16 }}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            placeholder="Enter about page content..."
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      ) : (
        <div
          className="prose"
          style={{ maxWidth: '100%' }}
          dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br>') }}
        />
      )}
    </div>
  );
}
