import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notVerified, setNotVerified] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState(''); // '' | 'sending' | 'sent'

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotVerified(false);
    try {
      const d = await auth.login(form);
      login(d.user, d.token);
      navigate('/');
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED' || err.message?.includes('verify')) {
        setNotVerified(true);
        setResendEmail(form.email);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendStatus('sending');
    try {
      await auth.resendVerification(resendEmail);
    } catch {}
    setResendStatus('sent');
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
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.6rem', fontWeight: 400 }}>Welcome back</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>Sign in to your account</p>
        </div>

        <div className="card" style={{ padding: '28px 28px' }}>
          {notVerified ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
              <p style={{ fontWeight: 500, marginBottom: 8 }}>Email not verified</p>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
                Please verify your email address before logging in. Check your inbox for the verification link.
              </p>
              {resendStatus === 'sent' ? (
                <div style={{ padding: '10px 14px', background: 'rgba(76,175,125,0.1)', border: '1px solid var(--success)', borderRadius: 8, color: 'var(--success)', fontSize: 13 }}>
                  ✅ Verification email resent — check your inbox.
                </div>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendStatus === 'sending'}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
                </button>
              )}
              <button
                onClick={() => { setNotVerified(false); setResendStatus(''); }}
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 12 }}
              >
                Back
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500 }}>Password</label>
                  <Link to="/forgot-password" style={{ fontSize: 12, color: 'var(--accent)' }}>Forgot password?</Link>
                </div>
                <input
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>

              <div style={{ marginBottom: 20 }} />

              {error && (
                <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid var(--danger)', borderRadius: 7, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 40 }}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, marginTop: 20 }}>
          New here? <Link to="/register" style={{ color: 'var(--accent)' }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
