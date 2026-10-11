import { useState } from 'react';
import { reports as reportsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const REASONS = [
  'Misinformation / false claims',
  'Spam or self-promotion',
  'Harassment or abuse',
  'Hate speech',
  'Copyright violation',
  'Off-topic content',
  'Other',
];

/**
 * ReportModal — reusable modal for reporting posts, comments, or users
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   targetType: 'post' | 'comment' | 'user'
 *   targetId: string (UUID)
 *   targetLabel?: string (for display)
 */
export default function ReportModal({ open, onClose, targetType, targetId, targetLabel }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const finalReason = reason === 'Other' ? custom.trim() : reason;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!finalReason) return;
    setLoading(true);
    setError('');
    try {
      await reportsApi.submit(targetType, targetId, finalReason);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setReason('');
    setCustom('');
    setDone(false);
    setError('');
    onClose();
  }

  const typeLabel = { post: 'post', comment: 'comment', user: 'user' }[targetType] || targetType;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 420,
          padding: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Report {typeLabel}</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--muted)', lineHeight: 1 }}>×</button>
        </div>

        {!user ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Please sign in to report content.</p>
        ) : done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>Report submitted</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Our team will review it. Thank you for helping keep the community safe.</p>
            <button onClick={handleClose} className="btn btn-ghost btn-sm">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {targetLabel && (
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Reporting: <em>{targetLabel}</em>
              </p>
            )}

            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Reason for reporting:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {REASONS.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, padding: '6px 10px', borderRadius: 8, background: reason === r ? 'rgba(79,142,247,0.08)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => { setReason(r); setCustom(''); }}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  {r}
                </label>
              ))}
            </div>

            {reason === 'Other' && (
              <textarea
                className="input"
                style={{ minHeight: 72, resize: 'vertical', marginBottom: 12, fontSize: 13 }}
                placeholder="Describe the issue…"
                value={custom}
                onChange={e => setCustom(e.target.value)}
                autoFocus
              />
            )}

            {error && <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={handleClose} className="btn btn-ghost btn-sm">Cancel</button>
              <button
                type="submit"
                disabled={loading || !finalReason}
                style={{
                  padding: '7px 18px', borderRadius: 8, border: 'none',
                  background: 'var(--danger)', color: '#fff', fontSize: 13,
                  fontWeight: 500, cursor: loading || !finalReason ? 'not-allowed' : 'pointer',
                  opacity: loading || !finalReason ? 0.6 : 1,
                }}
              >
                {loading ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
