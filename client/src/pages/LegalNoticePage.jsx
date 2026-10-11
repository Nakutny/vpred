import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { legal } from '../lib/api';

const DEFAULT_CONTENT = `<h2>Legal Notice</h2>

<p><strong>Operator:</strong> vpred.org — Open Research Collective</p>
<p><strong>Contact:</strong> <a href="mailto:vpredmail@gmail.com">vpredmail@gmail.com</a></p>

<h3>Liability for Content</h3>
<p>All content published on vpred.org represents the personal research of individual authors, based solely on publicly available information. The platform operator does not guarantee the accuracy, completeness or timeliness of any content. Authors are solely responsible for the content they publish. Nothing on this platform constitutes legal, financial, or professional advice.</p>

<h3>Liability for Links</h3>
<p>This platform may contain links to external websites. We have no influence over the content of those sites and accept no responsibility for them. The respective providers or operators of linked pages are responsible for their content.</p>

<h3>Copyright</h3>
<p>Content created by the platform operator is subject to copyright law. Reproduction or distribution requires prior written consent. Content submitted by users remains the intellectual property of the respective author.</p>

<h3>Data Protection</h3>
<p>For information on how we handle personal data, please refer to our <a href="/privacy">Privacy Policy</a>.</p>

<h3>Dispute Resolution</h3>
<p>The European Commission provides a platform for online dispute resolution (ODR). We are not obliged to participate in dispute resolution proceedings before a consumer arbitration board.</p>`;

export default function LegalNoticePage() {
  const { isAdmin } = useAuth();
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Legal Notice — vpred.org';
    legal.get('impressum')
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
      await legal.update('impressum', editContent);
      setContent(editContent);
      setEditing(false);
      setMsg('Legal notice updated.');
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
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2rem', fontWeight: 400 }}>Legal Notice</h1>
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
            You can use plain text or basic HTML ({"<b>, <i>, <a>, <br>, <p>, <h2>, <h3>"}).
          </p>
          <textarea
            className="input"
            style={{ minHeight: 400, resize: 'vertical', fontFamily: 'monospace', fontSize: 13, marginBottom: 16 }}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            placeholder="Enter legal notice content..."
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
