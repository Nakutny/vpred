import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/api';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No verification token found in the link.'); return; }
    auth.verifyEmail(token)
      .then(d => { setStatus('success'); setMessage(d.message || 'Email verified!'); })
      .catch(err => { setStatus('error'); setMessage(err.message || 'Verification failed.'); });
  }, [token]);

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 20h18L12 2z" fill="var(--accent)"/>
          </svg>
          <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 22 }}>vpred.org</span>
        </Link>

        <div className="card" style={{ padding: '36px 28px' }}>
          {status === 'loading' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
              <h2 style={{ fontFamily: 'DM Serif Display, serif', fontWeight: 400, marginBottom: 8 }}>Verifying…</h2>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Please wait while we verify your email address.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontFamily: 'DM Serif Display, serif', fontWeight: 400, marginBottom: 8 }}>Email verified!</h2>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>{message}</p>
              <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>Sign in now</Link>
            </>
          )}
          {status === 'error' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
              <h2 style={{ fontFamily: 'DM Serif Display, serif', fontWeight: 400, marginBottom: 8 }}>Verification failed</h2>
              <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 24 }}>{message}</p>
              <Link to="/login" style={{ color: 'var(--accent)', fontSize: 14 }}>Go to login →</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
