import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { auth } from '../lib/api';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the URL.');
      return;
    }
    auth.verifyEmail(token)
      .then(res => { setStatus('success'); setMessage(res.message); })
      .catch(err => { setStatus('error'); setMessage(err.message); });
  }, [token]);

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      {status === 'loading' && (
        <>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <p style={{ color: 'var(--muted)' }}>Verifying your email…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.6rem', fontWeight: 400, marginBottom: 10 }}>
            Email verified!
          </h1>
          <p style={{ color: 'var(--muted)', marginBottom: 28 }}>{message}</p>
          <Link to="/login" className="btn btn-primary">Log in now</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.6rem', fontWeight: 400, marginBottom: 10 }}>
            Verification failed
          </h1>
          <p style={{ color: 'var(--muted)', marginBottom: 28 }}>{message}</p>
          <Link to="/login" className="btn btn-ghost">Back to login</Link>
        </>
      )}
    </div>
  );
}
