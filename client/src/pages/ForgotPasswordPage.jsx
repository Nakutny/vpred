import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try { await auth.forgotPassword(email); } catch { /* immer 200 */ }
    setSent(true);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 20h18L12 2z" fill="var(--accent)"/>
            </svg>
            <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 22 }}>vpred.org</span>
          </Link>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.6rem', fontWeight: 400 }}>Reset password</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>We'll send you a reset link</p>
        </div>

        <div className="card" style={{ padding: '28px 28px' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
              <h3 style={{ fontFamily: 'DM Serif Display, serif', fontWeight: 400, marginBottom: 8 }}>Check your inbox</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
                If <strong>{email}</strong> is registered, we've sent a password reset link. Check your spam folder too.
              </p>
              <p style={{ marginTop: 20 }}>
                <Link to="/login" style={{ color: 'var(--accent)', fontSize: 14 }}>← Back to login</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Your email address</label>
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 40 }}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>

        {!sent && (
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, marginTop: 20 }}>
            Remember it? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
