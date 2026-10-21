import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { navCounts as navCountsApi, messages as messagesApi } from '../lib/api';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [navCts, setNavCts] = useState({
    feed: null, essays: null, texts: null,
    categories: null, users: null, friends: null, music: null,
  });
  const pollRef = useRef(null);

  async function fetchCounts() {
    try {
      const [counts, msgRes] = await Promise.all([
        navCountsApi.get(),
        user ? messagesApi.unreadCount() : Promise.resolve({ count: 0 }),
      ]);
      setNavCts(counts);
      setUnread(msgRes.count || 0);
    } catch (_) {}
  }

  useEffect(() => {
    fetchCounts();
    pollRef.current = setInterval(fetchCounts, 30000);
    return () => clearInterval(pollRef.current);
  }, [user]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const path = location.pathname;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 20 }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 20h18L12 2z" fill="var(--accent)" opacity="0.9"/>
              <path d="M12 7L6.5 18h11L12 7z" fill="var(--bg)"/>
            </svg>
            <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 20, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              vpred<span style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 400 }}>.org</span>
            </span>
          </Link>

          {/* Nav */}
          <nav style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <NavCount to="/" label="Feed" active={path === '/'} count={navCts.feed} />
            <NavCount to="/essays" label="Essays" active={path.startsWith('/essays')} count={navCts.essays} />
            <NavCount to="/texts" label="Texts" active={path.startsWith('/texts') || path.startsWith('/stories')} count={navCts.texts} />
            <NavCount to="/music" label="Music" active={path.startsWith('/music')} count={navCts.music} />
            <NavCount to="/categories" label="Categories" active={path.startsWith('/categories') || path.startsWith('/category')} count={navCts.categories} />
            <NavCount to="/users" label="Users" active={path.startsWith('/users')} count={navCts.users} />
            {user && (
              <NavCount to="/friends" label="Friends" active={path.startsWith('/friends')} count={navCts.friends} />
            )}
            {isAdmin && (
              <NavCount to="/admin" label="Admin" active={path.startsWith('/admin')} accent />
            )}
          </nav>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {user ? (
              <>
                <Link to="/new" className="btn btn-primary btn-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Write
                </Link>
                {/* Messages */}
                <Link to="/messages" style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 6, color: 'var(--muted)' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {unread > 0 && (
                    <span style={{
                      position: 'absolute', top: 1, right: 1,
                      background: 'var(--accent)', color: '#fff',
                      borderRadius: '50%', width: 16, height: 16,
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
                {/* Avatar menu */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: 'var(--accent)', border: 'none', cursor: 'pointer',
                      color: '#fff', fontWeight: 600, fontSize: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {user.username[0].toUpperCase()}
                  </button>
                  {menuOpen && (
                    <>
                      <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                      <div style={{
                        position: 'absolute', right: 0, top: 42,
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '6px', minWidth: 180, zIndex: 200,
                      }}>
                        <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{user.username}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{user.email}</div>
                        </div>
                        <MenuItem to={`/profile/${user.username}`} onClick={() => setMenuOpen(false)}>My profile</MenuItem>
                        <MenuItem to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</MenuItem>
                        <MenuItem to="/friends" onClick={() => setMenuOpen(false)}>Friends</MenuItem>
                        <MenuItem to="/music" onClick={() => setMenuOpen(false)}>Music</MenuItem>
                        {isAdmin && <MenuItem to="/admin" onClick={() => setMenuOpen(false)}>Admin Panel</MenuItem>}
                        <button
                          onClick={() => { handleLogout(); setMenuOpen(false); }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '8px 12px',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            borderRadius: 6, fontSize: 14, color: 'var(--danger)',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Join</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 24px', marginTop: 60 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 20h18L12 2z" fill="var(--accent)" opacity="0.7"/>
            </svg>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>vpred.org — Open Research Collective</span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 520 }}>
            All content represents personal research and opinions based on publicly available information. Not legal advice. Sources must be cited.
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavCount({ to, label, active, count, accent, badge }) {
  return (
    <Link to={to} style={{
      position: 'relative',
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 11px',
      borderRadius: 6,
      fontSize: 14,
      fontWeight: active ? 500 : 400,
      color: accent ? 'var(--accent)' : active ? 'var(--text)' : 'var(--muted)',
      background: active ? 'var(--surface2)' : 'transparent',
      transition: 'all 0.15s',
      textDecoration: 'none',
    }}>
      {label}
      {count !== null && count !== undefined && (
        <span style={{
          fontSize: 12, fontWeight: 500,
          color: 'var(--muted)', opacity: 0.7, lineHeight: 1,
        }}>
          {count > 9999 ? '9999+' : count}
        </span>
      )}
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: 1, right: 2,
          background: 'var(--accent)', color: '#fff',
          borderRadius: '50%', width: 16, height: 16,
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

function MenuItem({ to, onClick, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{ display: 'block', padding: '8px 12px', borderRadius: 6, fontSize: 14, color: 'var(--text)', textDecoration: 'none' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </Link>
  );
}
