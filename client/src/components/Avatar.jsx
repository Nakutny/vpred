/**
 * Avatar component – shows user avatar image or letter initial fallback.
 * Props:
 *   username   – string (used for initial + aria-label)
 *   avatarUrl  – string | null
 *   size       – number (px, default 32)
 *   style      – extra style overrides
 *   clickable  – bool (default false): if true, clicking opens a lightbox
 */
import { useState, useEffect } from 'react';

export default function Avatar({ username, avatarUrl, size = 32, style = {}, clickable = false }) {
  const [broken, setBroken] = useState(false);
  const [lightbox, setLightbox] = useState(false);
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

  const showImage = avatarUrl && !broken;

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightbox) return;
    function onKey(e) { if (e.key === 'Escape') setLightbox(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  function handleClick(e) {
    if (!clickable || !showImage) return;
    e.preventDefault();
    e.stopPropagation();
    setLightbox(true);
  }

  return (
    <>
      <div
        style={{
          ...base,
          cursor: clickable && showImage ? 'zoom-in' : 'inherit',
          background: showImage ? 'transparent' : 'var(--accent)',
          fontSize: Math.max(10, Math.round(size * 0.38)),
          fontWeight: 600,
          color: '#fff',
        }}
        onClick={handleClick}
        title={clickable && showImage ? `View ${username}'s avatar` : undefined}
      >
        {showImage ? (
          <img
            src={avatarUrl}
            alt={username}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
            onError={() => setBroken(true)}
          />
        ) : (
          initial
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setLightbox(false)}
            style={{
              position: 'absolute', top: 20, right: 24,
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#fff', fontSize: 28, width: 44, height: 44,
              borderRadius: '50%', cursor: 'pointer', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>

          {/* Username label */}
          <div style={{
            position: 'absolute', bottom: 28, left: 0, right: 0,
            textAlign: 'center', color: 'rgba(255,255,255,0.7)',
            fontSize: 15, fontWeight: 500, letterSpacing: 0.3,
          }}>
            {username}
          </div>

          {/* Image — click on image doesn't close */}
          <img
            src={avatarUrl}
            alt={username}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 'min(480px, 90vw)',
              maxHeight: 'min(480px, 80vh)',
              borderRadius: 16,
              objectFit: 'contain',
              boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
              userSelect: 'none',
            }}
          />
        </div>
      )}
    </>
  );
}
