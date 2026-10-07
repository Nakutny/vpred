/**
 * Avatar component – shows user avatar image or letter initial fallback.
 * Props:
 *   username  – string (used for initial + aria-label)
 *   avatarUrl – string | null  (base64 or /avatars/xxx.svg path)
 *   size      – number (px, default 32)
 *   style     – extra style overrides
 */
export default function Avatar({ username, avatarUrl, size = 32, style = {} }) {
  const initial = username?.[0]?.toUpperCase() || '?';

  const base = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  if (avatarUrl) {
    return (
      <div style={base}>
        <img
          src={avatarUrl}
          alt={username}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          onError={e => {
            // Fallback to initial on broken image
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement.setAttribute('data-fallback', 'true');
          }}
        />
      </div>
    );
  }

  return (
    <div style={{
      ...base,
      background: 'var(--accent)',
      fontSize: Math.max(10, Math.round(size * 0.38)),
      fontWeight: 600,
      color: '#fff',
    }}>
      {initial}
    </div>
  );
}
