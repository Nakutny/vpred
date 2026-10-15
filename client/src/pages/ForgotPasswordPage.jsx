import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 24px' }}>
      <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to login
      </Link>

      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 8 }}>
        Forgot password
      </h1>

      {sent ? (
        <div style={{ padding: '20px 24px', background: 'rgba(76,175,125,0.08)', border: '1px solid var(--success)', borderRadius: 10, marginTop: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📬</div>
          <p style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 6 }}>Check your inbox</p>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            If <strong>{email}</strong> is registered, we've sent a reset link. Check your spam folder if it doesn't arrive within a few minutes.
          </p>
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Email address</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            {error && (
              <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid var(--danger)', borderRadius: 7, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: 14 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
