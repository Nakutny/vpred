import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { maintenance } from '../lib/api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Maintenance Page ─────────────────────────────────────────────────────────
function MaintenancePage({ message, estimatedEnd, onAdminLogin }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px', background: 'var(--bg)',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {/* Icon */}
        <div style={{ fontSize: 56, marginBottom: 24 }}>🔧</div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'DM Serif Display, serif', fontSize: '2rem', fontWeight: 400,
          marginBottom: 16, color: 'var(--text)',
        }}>
          Under Maintenance
        </h1>

        {/* Message */}
        <p style={{ fontSize: 16, color: 'var(--muted)', lineHeight: 1.7, marginBottom: estimatedEnd ? 12 : 32 }}>
          {message || 'The platform is temporarily under maintenance. Please check back soon.'}
        </p>

        {/* Estimated time */}
        {estimatedEnd && (
          <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 32 }}>
            Estimated completion: <strong style={{ color: 'var(--text)' }}>
              {new Date(estimatedEnd).toLocaleString('en-US', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </strong>
          </p>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />

        {/* Admin login hint */}
        <button onClick={onAdminLogin} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: 'var(--muted)', textDecoration: 'underline',
        }}>
          Admin login
        </button>
      </div>
    </div>
  );
}

// ─── Admin Login Modal ────────────────────────────────────────────────────────
function AdminLoginModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Login failed.'); setLoading(false); return; }
      if (data.user?.role !== 'admin') {
        setErr('This login is only available for admins during maintenance.');
        setLoading(false); return;
      }
      localStorage.setItem('token', data.token);
      onSuccess(data.user, data.token);
    } catch (e) { setErr('Connection error. Try again.'); setLoading(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 28, maxWidth: 380, width: '90%',
      }}>
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 20 }}>
          Admin Login
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MaintenanceGate ──────────────────────────────────────────────────────────
export default function MaintenanceGate({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState(null); // null = loading, { maintenance, message, estimated_end }
  const [showLogin, setShowLogin] = useState(false);
  const [adminOverride, setAdminOverride] = useState(false); // admin logged in during maintenance

  useEffect(() => {
    checkMaintenance();
    // Poll every 60 seconds so non-admin users get unblocked when maintenance ends
    const interval = setInterval(checkMaintenance, 60000);
    return () => clearInterval(interval);
  }, []);

  async function checkMaintenance() {
    try {
      const data = await maintenance.check();
      setStatus(data);
    } catch (_) {
      // If we can't reach the server, don't block the user
      setStatus({ maintenance: false });
    }
  }

  // Admin is already logged in — always pass through
  if (user?.role === 'admin') return children;

  // Admin logged in via maintenance modal
  if (adminOverride) return children;

  // Still loading
  if (status === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  // Normal operation
  if (!status.maintenance) return children;

  // Maintenance is ON — show maintenance page
  return (
    <>
      <MaintenancePage
        message={status.message}
        estimatedEnd={status.estimated_end}
        onAdminLogin={() => setShowLogin(true)}
      />
      {showLogin && (
        <AdminLoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={(adminUser, token) => {
            setShowLogin(false);
            setAdminOverride(true);
            // Force a page reload so AuthContext picks up the token
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
