import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { auth } from '../lib/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) return setError('Passwords do not match.');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (!token) return setError('Invalid reset link.');
    setLoading(true);
    try {
      await auth.resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--danger)' }}>Invalid reset link. Please request a new one.</p>
      <Link to="/forgot-password" className="btn btn-ghost" style={{ marginTop: 16 }}>Request reset</Link>
    </div>
  );

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 8 }}>
        Set new password
      </h1>

      {done ? (
        <div style={{ padding: '20px 24px', background: 'rgba(76,175,125,0.08)', border: '1px solid var(--success)', borderRadius: 10, marginTop: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
          <p style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 6 }}>Password reset!</p>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Redirecting to login…</p>
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>Choose a new password for your account.</p>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>New password</label>
              <input
                className="input"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required minLength={8} autoFocus
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Confirm password</label>
              <input
                className="input"
                type="password"
                placeholder="Repeat new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                style={confirm && newPassword !== confirm ? { borderColor: 'var(--danger)' } : {}}
              />
              {confirm && newPassword !== confirm && (
                <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>Passwords do not match.</p>
              )}
            </div>
            {error && (
              <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid var(--danger)', borderRadius: 7, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: 14 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
