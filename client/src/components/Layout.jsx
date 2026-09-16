import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');

  function handleSearch(e) {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/?search=${encodeURIComponent(searchVal.trim())}`);
      setSearchVal('');
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 24 }}>
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

          {/* Nav links */}
          <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <NavLink to="/" label="Feed" active={location.pathname === '/'} />
            <NavLink to="/categories" label="Categories" active={location.pathname === '/categories'} />
            {isAdmin && <NavLink to="/admin" label="Admin" active={location.pathname.startsWith('/admin')} accent />}
          </nav>

          {/* Search */}
          <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 340 }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="input"
                style={{ paddingLeft: 34, height: 36, fontSize: 13 }}
                placeholder="Search posts..."
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
              />
            </div>
          </form>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {user ? (
              <>
                <Link to="/new" className="btn btn-primary btn-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Write
                </Link>
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
                    <div style={{
                      position: 'absolute', right: 0, top: 42,
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '6px', minWidth: 180, zIndex: 200,
                    }}>
                      <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{user.username}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{user.email}</div>
                      </div>
                      {isAdmin && (
                        <DropdownItem onClick={() => { navigate('/admin'); setMenuOpen(false); }} label="Admin Panel" />
                      )}
                      <DropdownItem onClick={() => { handleLogout(); setMenuOpen(false); }} label="Sign out" danger />
                    </div>
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

      {/* Main */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '28px 24px',
        marginTop: 60,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 20h18L12 2z" fill="var(--accent)" opacity="0.7"/>
            </svg>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              vpred.org — Open Research Collective
            </span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 520 }}>
            All content represents personal research and opinions based on publicly available information. Not legal advice. Sources must be cited.
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ to, label, active, accent }) {
  return (
    <Link to={to} style={{
      padding: '5px 12px',
      borderRadius: 6,
      fontSize: 14,
      fontWeight: active ? 500 : 400,
      color: accent ? 'var(--accent)' : active ? 'var(--text)' : 'var(--muted)',
      background: active ? 'var(--surface2)' : 'transparent',
      transition: 'all 0.15s',
    }}>
      {label}
    </Link>
  );
}

function DropdownItem({ onClick, label, danger }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', padding: '8px 12px',
      background: 'transparent', border: 'none', cursor: 'pointer',
      borderRadius: 6, fontSize: 14,
      color: danger ? 'var(--danger)' : 'var(--text)',
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => e.target.style.background = 'var(--border)'}
    onMouseLeave={e => e.target.style.background = 'transparent'}
    >
      {label}
    </button>
  );
}
