import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://vpred-oxfv.onrender.com';

export default function MaintenancePage({ message, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.status === 503 || data.code === 'MAINTENANCE') {
        setError("Sorry, but you're not an Admin or Moderator.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Invalid username or password.');
        setLoading(false);
        return;
      }

      if (data.token && data.user) {
        if (!['admin', 'moderator'].includes(data.user.role)) {
          setError("Sorry, but you're not an Admin or Moderator.");
          setLoading(false);
          return;
        }
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setError(data.error || 'Login failed.');
      }
    } catch (err) {
      setError('Could not reach the server. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem',
    }}>
      <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>🔧</div>

      <h1 style={{
        color: '#ffffff',
        fontSize: '1.875rem',
        fontWeight: 700,
        margin: '0 0 0.625rem',
        letterSpacing: '-0.02em',
      }}>
        Under Maintenance
      </h1>

      <p style={{
        color: '#777',
        fontSize: '0.9375rem',
        textAlign: 'center',
        maxWidth: '400px',
        margin: '0 0 2.5rem',
        lineHeight: 1.65,
      }}>
        {message || "vpred.org is temporarily unavailable. We'll be back shortly."}
      </p>

      <div style={{
        width: '100%',
        maxWidth: '340px',
        background: '#161616',
        border: '1px solid #242424',
        borderRadius: '14px',
        padding: '1.75rem',
      }}>
        <p style={{
          color: '#444',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: '0 0 1.25rem',
          fontWeight: 600,
        }}>
          Staff Login
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoFocus
            style={{
              background: '#0d0d0d',
              border: '1px solid #242424',
              borderRadius: '8px',
              padding: '0.6875rem 1rem',
              color: '#fff',
              fontSize: '0.9375rem',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{
              background: '#0d0d0d',
              border: '1px solid #242424',
              borderRadius: '8px',
              padding: '0.6875rem 1rem',
              color: '#fff',
              fontSize: '0.9375rem',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />

          {error && (
            <p style={{
              color: '#ff5555',
              fontSize: '0.875rem',
              margin: 0,
              padding: '0.5rem 0.75rem',
              background: 'rgba(255,85,85,0.08)',
              borderRadius: '6px',
              border: '1px solid rgba(255,85,85,0.15)',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#222' : '#fff',
              color: loading ? '#555' : '#000',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6875rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.375rem',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>

      <p style={{ color: '#2a2a2a', fontSize: '0.75rem', marginTop: '2.5rem', fontWeight: 500 }}>
        vpred.org
      </p>
    </div>
  );
}
