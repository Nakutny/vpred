import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMusicPlayer } from '../contexts/MusicContext';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MiniPlayer() {
  const {
    currentTrack, isPlaying, progress, duration,
    togglePlay, playNext, playPrev, seekTo, changeVolume, volume, closePlayer,
    tracks,
  } = useMusicPlayer();

  const barRef = useRef(null);

  if (!currentTrack) return null;

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;
  const idx = tracks.findIndex(t => t.id === currentTrack.id);
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < tracks.length - 1;

  function handleBarClick(e) {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct);
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      zIndex: 500,
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
    }}>
      {/* Progress bar — clickable */}
      <div
        ref={barRef}
        onClick={handleBarClick}
        style={{
          width: '100%', height: 3,
          background: 'var(--border)',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${progressPct}%`,
          background: 'var(--accent)',
          borderRadius: 2,
          transition: 'width 0.3s linear',
        }} />
      </div>

      {/* Controls row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 20px', height: 62, gap: 16,
      }}>
        {/* Cover + title */}
        <Link to="/music" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flex: '0 0 auto', maxWidth: 240, overflow: 'hidden' }}>
          {currentTrack.cover_url ? (
            <img src={currentTrack.cover_url} alt="" style={{ width: 36, height: 36, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 5, background: 'var(--surface2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8">
                <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
              </svg>
            </div>
          )}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentTrack.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Selfmade Music
            </div>
          </div>
        </Link>

        {/* Playback controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          {/* Prev */}
          <button onClick={playPrev} disabled={!hasPrev} title="Previous" style={{ background: 'none', border: 'none', cursor: hasPrev ? 'pointer' : 'default', color: hasPrev ? 'var(--text)' : 'var(--border)', padding: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
            </svg>
          </button>

          {/* Play/Pause */}
          <button onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'} style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'var(--accent)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0,
          }}>
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          {/* Next */}
          <button onClick={playNext} disabled={!hasNext} title="Next" style={{ background: 'none', border: 'none', cursor: hasNext ? 'pointer' : 'default', color: hasNext ? 'var(--text)' : 'var(--border)', padding: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm2.5-6 8.5 6V6l-8.5 6zM16 6h2v12h-2z"/>
            </svg>
          </button>

          {/* Time */}
          <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 72, textAlign: 'center' }}>
            {formatTime(progress)} / {formatTime(duration)}
          </span>

          {/* Volume — hidden on very small screens */}
          <div className="miniplayer-volume" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              {volume > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>}
            </svg>
            <input
              type="range" min="0" max="1" step="0.02"
              value={volume}
              onChange={e => changeVolume(parseFloat(e.target.value))}
              style={{ width: 70, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </div>

          {/* Close */}
          <button onClick={closePlayer} title="Close player" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center', marginLeft: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
