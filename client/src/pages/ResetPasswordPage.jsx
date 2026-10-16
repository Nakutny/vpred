import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { auth } from '../lib/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  if (!token) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
          <p style={{ color: 'var(--danger)' }}>Invalid reset link. Please request a new one.</p>
          <Link to="/forgot-password" style={{ color: 'var(--accent)', marginTop: 16, display: 'inline-block' }}>Request reset link</Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { setMessage('Passwords do not match.'); setStatus('error'); return; }
    if (form.newPassword.length < 8) { setMessage('Password must be at least 8 characters.'); setStatus('error'); return; }
    setStatus('loading');
    try {
      const d = await auth.resetPassword(token, form.newPassword);
      setStatus('success');
      setMessage(d.message || 'Password reset successfully.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Reset failed.');
    }
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
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.6rem', fontWeight: 400 }}>Set new password</h1>
        </div>

        <div className="card" style={{ padding: '28px 28px' }}>
          {status === 'success' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontFamily: 'DM Serif Display, serif', fontWeight: 400, marginBottom: 8 }}>Password reset!</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>{message}</p>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>Redirecting to login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>New password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={form.newPassword}
                  onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                  required minLength={8}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Confirm new password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Repeat password"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  required
                  style={form.confirm && form.newPassword !== form.confirm ? { borderColor: 'var(--danger)' } : {}}
                />
                {form.confirm && form.newPassword !== form.confirm && (
                  <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>Passwords do not match.</p>
                )}
              </div>
              {status === 'error' && (
                <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid var(--danger)', borderRadius: 7, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>
                  {message}
                </div>
              )}
              <button type="submit" disabled={status === 'loading'} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 40 }}>
                {status === 'loading' ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
