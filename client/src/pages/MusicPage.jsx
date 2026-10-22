import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
  return localStorage.getItem('token');
}

async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MusicPage() {
  const { user, isAdmin } = useAuth();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', description: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const audioRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    loadTracks();
  }, []);

  async function loadTracks() {
    try {
      setLoading(true);
      const data = await apiRequest('/api/music');
      setTracks(data.tracks || []);
    } catch (err) {
      // Treat as empty list rather than showing an error — table may just be empty
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      // Auto-play next track
      const idx = tracks.findIndex(t => t.id === currentTrack?.id);
      if (idx >= 0 && idx < tracks.length - 1) {
        playTrack(tracks[idx + 1]);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentTrack, tracks]);

  function playTrack(track) {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
        setIsPlaying(true);
      }
      return;
    }

    setCurrentTrack(track);
    setProgress(0);
    setDuration(0);
    audio.src = `${BASE}/api/music/${track.id}/stream`;
    audio.volume = volume;
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }

  function seekTo(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = pct * duration;
    setProgress(pct * duration);
  }

  function changeVolume(e) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }

  function playNext() {
    const idx = tracks.findIndex(t => t.id === currentTrack?.id);
    if (idx >= 0 && idx < tracks.length - 1) playTrack(tracks[idx + 1]);
  }

  function playPrev() {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setProgress(0);
      return;
    }
    const idx = tracks.findIndex(t => t.id === currentTrack?.id);
    if (idx > 0) playTrack(tracks[idx - 1]);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!uploadFile) { setUploadError('Please select an MP3 file.'); return; }
    if (!uploadForm.title.trim()) { setUploadError('Title is required.'); return; }
    if (uploadFile.size > 20 * 1024 * 1024) { setUploadError('File is too large. Maximum size is 20 MB.'); return; }

    setUploading(true);
    setUploadError('');
    try {
      // Convert MP3 to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          // result is "data:audio/mpeg;base64,XXXX..."
          const b64 = result.split(',')[1];
          if (!b64) { reject(new Error('Could not read file.')); return; }
          resolve(b64);
        };
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsDataURL(uploadFile);
      });

      // Get duration via Audio element before uploading
      const duration_seconds = await new Promise((resolve) => {
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => resolve(Math.round(audio.duration) || null);
        audio.onerror = () => resolve(null);
        audio.src = URL.createObjectURL(uploadFile);
      });

      await apiRequest('/api/music', {
        method: 'POST',
        body: JSON.stringify({
          title: uploadForm.title.trim(),
          description: uploadForm.description.trim() || null,
          audio_base64: base64,
          mime_type: uploadFile.type || 'audio/mpeg',
          duration_seconds,
        }),
      });

      setShowUpload(false);
      setUploadForm({ title: '', description: '' });
      setUploadFile(null);
      await loadTracks();
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function deleteTrack(id) {
    if (!confirm('Delete this track?')) return;
    try {
      await apiRequest(`/api/music/${id}`, { method: 'DELETE' });
      if (currentTrack?.id === id) {
        setCurrentTrack(null);
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.src = '';
      }
      setTracks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      alert('Could not delete track: ' + err.message);
    }
  }

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <audio ref={audioRef} preload="metadata" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontFamily: 'DM Serif Display, serif', margin: 0, marginBottom: 6 }}>
            Selfmade Music
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 15, margin: 0 }}>
            Original tracks made from scratch
          </p>
        </div>
        {user && (
          <button
            onClick={() => setShowUpload(s => !s)}
            className="btn btn-primary btn-sm"
            style={{ gap: 6, display: 'flex', alignItems: 'center' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Upload track
          </button>
        )}
      </div>

      {/* Upload form (logged-in users) */}
      {showUpload && user && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 24, marginBottom: 32,
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 17 }}>Upload New Track</h3>
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Title *</label>
              <input
                className="input"
                value={uploadForm.title}
                onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Track title"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Description</label>
              <textarea
                className="input"
                value={uploadForm.description}
                onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short description (optional)"
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>MP3 File *</label>
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,.mp3"
                onChange={e => setUploadFile(e.target.files[0] || null)}
                style={{ fontSize: 14 }}
                required
              />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Max. 20 MB</div>
            </div>
            {uploadError && (
              <div style={{ color: 'var(--danger)', fontSize: 13 }}>{uploadError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowUpload(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: 'var(--danger)', padding: 16, background: 'rgba(239,68,68,0.08)', borderRadius: 8, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {/* Track list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>
      ) : tracks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>No tracks uploaded yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tracks.map((track, i) => {
            const isActive = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', borderRadius: 10,
                  background: isActive ? 'rgba(79,142,247,0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(79,142,247,0.2)' : '1px solid transparent',
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Play button — always visible */}
                <div
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isActive ? 'var(--accent)' : 'var(--surface2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, cursor: 'pointer',
                  }}
                  onClick={() => playTrack(track)}
                >
                  {isActive && isPlaying ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={isActive ? 'white' : 'var(--muted)'}>
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                  )}
                </div>

                {/* Track info */}
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => playTrack(track)}>
                  <div style={{
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--accent)' : 'var(--text)',
                    fontSize: 15, marginBottom: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {track.title}
                  </div>
                  {track.uploader_username && (
                    <div style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.uploader_username}
                    </div>
                  )}
                  {track.description && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.description}
                    </div>
                  )}
                </div>

                {/* Duration */}
                {track.duration_seconds && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>
                    {formatTime(track.duration_seconds)}
                  </div>
                )}

                {/* Download button — uses /download endpoint (Content-Disposition: attachment)
                    so the browser always saves the file. <a download> only works same-origin;
                    this backend endpoint works cross-origin. */}
                <a
                  href={`${BASE}/api/music/${track.id}/download`}
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', padding: '4px 6px', borderRadius: 6,
                    display: 'flex', alignItems: 'center', textDecoration: 'none',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
                  title="Download MP3"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </a>

                {/* Delete (own track or admin) */}
                {user && (isAdmin || track.uploader_id === user.id) && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteTrack(track.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 6px', borderRadius: 6, fontSize: 16 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
                    title="Delete track"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Player bar — fixed at bottom when a track is loaded */}
      {currentTrack && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          padding: '12px 24px',
          zIndex: 200,
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Track name */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentTrack.title}
              </div>
              {currentTrack.artist && (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{currentTrack.artist}</div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <PlayerBtn onClick={playPrev} title="Previous">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="19,20 9,12 19,4"/><rect x="5" y="4" width="3" height="16"/>
                </svg>
              </PlayerBtn>
              <button
                onClick={togglePlay}
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--accent)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff',
                }}
              >
                {isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                )}
              </button>
              <PlayerBtn onClick={playNext} title="Next">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,4 15,12 5,20"/><rect x="16" y="4" width="3" height="16"/>
                </svg>
              </PlayerBtn>
            </div>

            {/* Progress bar */}
            <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{formatTime(progress)}</span>
              <div
                ref={progressRef}
                onClick={seekTo}
                style={{
                  flex: 1, height: 4, background: 'var(--border)',
                  borderRadius: 2, cursor: 'pointer', position: 'relative',
                }}
              >
                <div style={{
                  width: `${progressPct}%`, height: '100%',
                  background: 'var(--accent)', borderRadius: 2,
                  transition: 'width 0.1s linear',
                }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{formatTime(duration)}</span>
            </div>

            {/* Volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
                {volume > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>}
                {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>}
              </svg>
              <input
                type="range" min="0" max="1" step="0.05"
                value={volume} onChange={changeVolume}
                style={{ width: 70, cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Spacer so player bar doesn't overlap last track */}
      {currentTrack && <div style={{ height: 80 }} />}
    </div>
  );
}

function PlayerBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {children}
    </button>
  );
}
