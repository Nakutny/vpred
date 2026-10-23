import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { navCounts as navCountsApi, messages as messagesApi, notifications as notificationsApi } from '../lib/api';
import Avatar from './Avatar';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [navCts, setNavCts] = useState({ feed: null, essays: null, texts: null, categories: null, users: null, music: null, friends: null });
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const notifRef = useRef(null);

  // Poll for nav counts + unread messages + notifications
  useEffect(() => {
    if (!user) {
      setNavCts({ feed: null, essays: null, texts: null, categories: null, users: null, friends: null });
      setPendingCount(0);
      setUnreadMsgCount(0);
      setNotifications([]);
      setUnreadNotifCount(0);
    }

    async function fetchAll() {
      try {
        // nav-counts covers ALL nav badge numbers in one request
        // messages unread + notifications run in parallel alongside
        const [counts, msgRes] = await Promise.all([
          navCountsApi.get(),
          user ? messagesApi.unreadCount() : Promise.resolve({ count: 0 }),
        ]);
        setNavCts(counts);
        setUnreadMsgCount(msgRes.count || 0);
        // pending friend requests is inferred from navCounts only when logged in
        // (friends count is total accepted, not pending — keep existing pending poll via notifications)
      } catch {}
    }

    async function fetchNotifications() {
      if (!user) return;
      try {
        const res = await notificationsApi.list();
        setNotifications(res.notifications || []);
        setUnreadNotifCount(res.unread || 0);
        // Derive pending friend requests count from notifications list
        const pending = (res.notifications || []).filter(
          n => n.type === 'friend_request' && !n.is_read
        ).length;
        setPendingCount(pending);
      } catch {}
    }

    fetchAll();
    fetchNotifications();
    const interval = setInterval(() => {
      fetchAll();
      fetchNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  async function markAllRead() {
    try {
      await notificationsApi.readAll();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadNotifCount(0);
      setPendingCount(0);
    } catch {}
  }

  async function deleteNotif(id) {
    try {
      await notificationsApi.delete(id);
      setNotifications(prev => {
        const notif = prev.find(n => n.id === id);
        if (notif && !notif.is_read && notif.type === 'friend_request') {
          setPendingCount(p => Math.max(0, p - 1));
        }
        return prev.filter(n => n.id !== id);
      });
      setUnreadNotifCount(prev => {
        const notif = notifications.find(n => n.id === id);
        return notif && !notif.is_read ? Math.max(0, prev - 1) : prev;
      });
    } catch {}
  }

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

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  const totalBell = unreadNotifCount + unreadMsgCount;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 24 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 20h18L12 2z" fill="var(--accent)" opacity="0.9"/>
              <path d="M12 7L6.5 18h11L12 7z" fill="var(--bg)"/>
            </svg>
            <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 20, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              vpred<span style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 400 }}>.org</span>
            </span>
          </Link>

          <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <NavCount to="/" label="Research"    active={location.pathname === '/'}                    count={navCts.feed} />
            <NavCount to="/essays" label="Essays"    active={location.pathname.startsWith('/essays')}     count={navCts.essays} />
            <NavCount to="/texts"  label="Texts"     active={location.pathname.startsWith('/texts') || location.pathname.startsWith('/stories')} count={navCts.texts} />
            <NavCount to="/categories" label="Categories" active={location.pathname === '/categories'}   count={navCts.categories} />
            <NavCount to="/users" label="Users"      active={location.pathname === '/users'}              count={navCts.users} />
            <NavCount to="/music"   label="Selfmade Music" active={location.pathname === '/music'} count={navCts.music} />
            <NavLink  to="/support" label="Support me" active={location.pathname === '/support'} />
            <NavLink  to="/donate"  label="Donate"    active={location.pathname === '/donate'} />
            {user && (
              <NavCount
                to="/friends"
                label="Friends"
                active={location.pathname === '/friends'}
                count={navCts.friends}
                badge={pendingCount}
              />
            )}
            {isAdmin && <NavLink to="/admin" label="Admin" active={location.pathname.startsWith('/admin')} accent />}
          </nav>

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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {user ? (
              <>
                {/* Messages icon */}
                <Link to="/friends" title="Messages" style={{ position: 'relative', display: 'flex', alignItems: 'center', color: 'var(--muted)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {unreadMsgCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4,
                      background: 'var(--accent)', color: '#fff',
                      borderRadius: 9999, fontSize: 9, fontWeight: 700,
                      minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px',
                    }}>
                      {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                    </span>
                  )}
                </Link>

                {/* Notification Bell */}
                <div ref={notifRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => {
                      const opening = !notifOpen;
                      setNotifOpen(opening);
                      // Auto-mark all as read when opening the dropdown
                      if (opening && unreadNotifCount > 0) markAllRead();
                    }}
                    title="Notifications"
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    {unreadNotifCount > 0 && (
                      <span style={{
                        position: 'absolute', top: -3, right: -3,
                        background: 'var(--danger)', color: '#fff',
                        borderRadius: 9999, fontSize: 9, fontWeight: 700,
                        minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 3px',
                      }}>
                        {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div style={{
                      position: 'absolute', right: 0, top: 38,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 12, width: 340, maxHeight: 440, overflowY: 'auto',
                      zIndex: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
                        {unreadNotifCount > 0 && (
                          <button onClick={markAllRead} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            Mark all read
                          </button>
                        )}
                      </div>

                      {notifications.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: '12px 16px',
                            background: n.is_read ? 'transparent' : 'rgba(79,142,247,0.06)',
                            borderBottom: '1px solid var(--border)',
                          }}>
                            <div style={{ flexShrink: 0, marginTop: 1 }}>
                              {n.type === 'friend_request' && <span style={{ fontSize: 16 }}>👤</span>}
                              {n.type === 'friend_accepted' && <span style={{ fontSize: 16 }}>🤝</span>}
                              {(n.type !== 'friend_request' && n.type !== 'friend_accepted') && <span style={{ fontSize: 16 }}>🔔</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {n.link ? (
                                <Link to={n.link} onClick={() => setNotifOpen(false)} style={{ display: 'block', color: 'var(--text)', textDecoration: 'none' }}>
                                  <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: 13, marginBottom: 2 }}>{n.title}</div>
                                  {n.body && <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>}
                                </Link>
                              ) : (
                                <>
                                  <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: 13, marginBottom: 2 }}>{n.title}</div>
                                  {n.body && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{n.body}</div>}
                                </>
                              )}
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                            </div>
                            <button onClick={() => deleteNotif(n.id)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--muted)', lineHeight: 1, padding: '2px 4px' }}>×</button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <Link to="/new" className="btn btn-primary btn-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Write
                </Link>

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: 'var(--surface2)', border: '2px solid var(--border)',
                      cursor: 'pointer', overflow: 'hidden', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Avatar username={user.username} avatarUrl={user.avatar_url} size={34} />
                  </button>
                  {menuOpen && (
                    <>
                      <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                      <div style={{
                        position: 'absolute', right: 0, top: 42,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '6px', minWidth: 180, zIndex: 200,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      }}>
                        <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{user.username}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{user.email}</div>
                        </div>
                        <MenuItem to={`/profile/${user.username}`} label="My profile" onClose={() => setMenuOpen(false)} />
                        <MenuItem to="/dashboard" label="My Dashboard" onClose={() => setMenuOpen(false)} />
                        <MenuItem to="/essays" label="Essays" onClose={() => setMenuOpen(false)} />
                        <MenuItem to="/texts" label="Texts" onClose={() => setMenuOpen(false)} />
                        <MenuItem to="/users" label="Users" onClose={() => setMenuOpen(false)} />
                        <MenuItem to="/friends" label={`Friends${pendingCount > 0 ? ` (${pendingCount})` : ''}`} onClose={() => setMenuOpen(false)} />
                        {isAdmin && <MenuItem to="/admin" label="Admin Panel" onClose={() => setMenuOpen(false)} />}
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

      <main style={{ flex: 1 }}>
        {children}
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 24px', marginTop: 60 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 20h18L12 2z" fill="var(--accent)" opacity="0.7"/>
            </svg>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>vpred.org — Open Research Collective</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              All content represents personal research based on publicly available information. Not legal advice.
            </span>
            <Link to="/essays" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3 }}>Essays</Link>
            <Link to="/support" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3 }}>Support me</Link>
            <Link to="/donate" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3 }}>Donate</Link>
            <Link to="/about" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3 }}>About</Link>
            <Link to="/privacy" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3 }}>Privacy</Link>
            <Link to="/legal-notice" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3 }}>Legal Notice</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Nav link with optional count badge (grey, small) + optional pending badge (accent)
function NavCount({ to, label, active, count, badge }) {
  return (
    <Link to={to} style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 12px', borderRadius: 6, fontSize: 14,
      fontWeight: active ? 500 : 400,
      color: active ? 'var(--text)' : 'var(--muted)',
      background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
      transition: 'all 0.15s',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
    }}>
      {label}
      {count !== null && count !== undefined && (
        <span style={{
          fontSize: 10, fontWeight: 500,
          color: active ? 'var(--muted)' : 'var(--muted)',
          opacity: 0.7,
          lineHeight: 1,
        }}>
          {count > 9999 ? '9999+' : count}
        </span>
      )}
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: 1, right: 2,
          background: 'var(--accent)', color: '#fff',
          borderRadius: 9999, fontSize: 9, fontWeight: 700,
          minWidth: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 3px',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

function NavLink({ to, label, active, accent }) {
  return (
    <Link to={to} style={{
      padding: '5px 12px', borderRadius: 6, fontSize: 14,
      fontWeight: active ? 500 : 400,
      color: accent ? 'var(--accent)' : active ? 'var(--text)' : 'var(--muted)',
      background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
      transition: 'all 0.15s',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </Link>
  );
}

function MenuItem({ to, label, onClose }) {
  return (
    <Link
      to={to}
      onClick={onClose}
      style={{ display: 'block', padding: '8px 12px', borderRadius: 6, fontSize: 14, color: 'var(--text)', textDecoration: 'none' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {label}
    </Link>
  );
}
