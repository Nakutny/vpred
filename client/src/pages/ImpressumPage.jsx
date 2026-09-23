import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { legal } from '../lib/api';

export default function ImpressumPage() {
  const { isAdmin } = useAuth();
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    legal.get('impressum')
      .then(d => {
        setContent(d.page.content);
        setEditContent(d.page.content);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await legal.update('impressum', editContent);
      setContent(editContent);
      setEditing(false);
      setMsg('Impressum updated.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2rem', fontWeight: 400 }}>Impressum</h1>
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
            You can use plain text or basic HTML ({"<b>, <i>, <a>, <br>, <p>"}).
          </p>
          <textarea
            className="input"
            style={{ minHeight: 400, resize: 'vertical', fontFamily: 'monospace', fontSize: 13, marginBottom: 16 }}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            placeholder="Enter impressum content..."
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      ) : content ? (
        <div
          className="prose"
          style={{ maxWidth: '100%' }}
          dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br>') }}
        />
      ) : (
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>
          {isAdmin
            ? 'No impressum content yet. Click "Edit" to add content.'
            : 'Impressum content coming soon.'}
        </div>
      )}
    </div>
  );
}
