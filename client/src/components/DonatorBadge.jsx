// DonatorBadge — renders the donator badge chip
// Usage: <DonatorBadge />  (always same style)
export default function DonatorBadge({ style = {} }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 6px',
      borderRadius: 4, background: '#7B2FBE22', color: '#7B2FBE',
      border: '1px solid #7B2FBE44', letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      Donator
    </span>
  );
}

// UsernameWithColor — renders a username with donator color if applicable
// Usage: <UsernameWithColor user={user} />
export function UsernameWithColor({ user, style = {}, children }) {
  if (!user) return null;
  const name = children || user.username;
  if (user.is_donator && user.donator_color) {
    return (
      <span style={{ color: user.donator_color, fontWeight: 700, ...style }}>
        {name}
      </span>
    );
  }
  return <span style={style}>{name}</span>;
}
