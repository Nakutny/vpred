// ─── Badge Components ─────────────────────────────────────────────────────────

// DonatorBadge — shown when user is_donator AND donator_badge_visible
export function DonatorBadge({ style = {} }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 6px',
      borderRadius: 4, background: '#7B2FBE22', color: '#7B2FBE',
      border: '1px solid #7B2FBE44', letterSpacing: '0.02em',
      whiteSpace: 'nowrap', ...style,
    }}>
      Donator
    </span>
  );
}

// ModBadge — shown for moderators
export function ModBadge({ style = {} }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 6px',
      borderRadius: 4, background: '#0F9A9A22', color: '#0F9A9A',
      border: '1px solid #0F9A9A44', letterSpacing: '0.02em',
      whiteSpace: 'nowrap', ...style,
    }}>
      MOD
    </span>
  );
}

// OwnerBadge — shown for admins
export function OwnerBadge({ style = {} }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 6px',
      borderRadius: 4, background: '#E6394622', color: '#E63946',
      border: '1px solid #E6394644', letterSpacing: '0.02em',
      whiteSpace: 'nowrap', ...style,
    }}>
      Owner
    </span>
  );
}

// UserBadges — renders all applicable badges for a user in one go
// Usage: <UserBadges user={user} />
export function UserBadges({ user, style = {} }) {
  if (!user) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...style }}>
      {user.role === 'admin' && <OwnerBadge />}
      {user.role === 'moderator' && <ModBadge />}
      {user.is_donator && user.donator_badge_visible !== false && <DonatorBadge />}
    </span>
  );
}

// UsernameWithColor — renders username with donator/admin color if set
// Usage: <UsernameWithColor user={user} />
export function UsernameWithColor({ user, style = {}, children }) {
  if (!user) return null;
  const name = children || user.username;
  if (user.donator_color) {
    return <span style={{ color: user.donator_color, fontWeight: 700, ...style }}>{name}</span>;
  }
  return <span style={style}>{name}</span>;
}

// Default export for backwards compat
export default DonatorBadge;
