import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { uploadImage, looksLikeImage } from '../lib/uploadImage';

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

// Image helpers imported from ../lib/uploadImage

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
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null); // local preview
  const [pendingCoverUrl, setPendingCoverUrl] = useState(null); // R2 URL
  // Edit modal state
  const [editTrack, setEditTrack] = useState(null); // track being edited
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [editCoverFile, setEditCoverFile] = useState(null);
  const [editCoverPreview, setEditCoverPreview] = useState(null);
  const [editCoverUrl, setEditCoverUrl] = useState(null); // new R2 URL for cover
  const [editCoverCleared, setEditCoverCleared] = useState(false); // user explicitly removed cover
  const [editCoverUploading, setEditCoverUploading] = useState(false); // cover upload in progress
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
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

  async function handleCoverSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ok = await looksLikeImage(file);
    if (!ok) { setUploadError('Cover must be an image file.'); e.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('Cover image too large. Max 5 MB.'); e.target.value = ''; return; }
    // Show local preview immediately — stays visible the whole time
    const reader = new FileReader();
    reader.onload = ev => setCoverPreview(ev.target.result);
    reader.readAsDataURL(file);
    setCoverFile(file);
    setPendingCoverUrl(null);
    setUploadError('');
    // Upload to R2 in background
    try {
      const url = await uploadImage(file);
      setPendingCoverUrl(url);
    } catch (err) {
      setUploadError('Cover upload failed: ' + err.message);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!uploadFile) { setUploadError('Please select an MP3 file.'); return; }
    if (!uploadForm.title.trim()) { setUploadError('Title is required.'); return; }
    if (uploadFile.size > 20 * 1024 * 1024) { setUploadError('File is too large. Maximum size is 20 MB.'); return; }

    setUploading(true);
    setUploadError('');
    try {
      // Read audio as base64
      const audioDataUrl = await readFileAsDataURL(uploadFile);
      const base64 = audioDataUrl.split(',')[1];
      if (!base64) throw new Error('Could not read audio file.');

      // Get duration via Audio element
      const duration_seconds = await new Promise((resolve) => {
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => resolve(Math.round(audio.duration) || null);
        audio.onerror = () => resolve(null);
        audio.src = URL.createObjectURL(uploadFile);
      });

      // Cover image was already uploaded to R2 in handleCoverSelect
      const cover_url = pendingCoverUrl || null;

      await apiRequest('/api/music', {
        method: 'POST',
        body: JSON.stringify({
          title: uploadForm.title.trim(),
          description: uploadForm.description.trim() || null,
          audio_base64: base64,
          mime_type: uploadFile.type || 'audio/mpeg',
          duration_seconds,
          cover_url,
        }),
      });

      setShowUpload(false);
      setUploadForm({ title: '', description: '' });
      setUploadFile(null);
      setCoverFile(null);
      setCoverPreview(null);
      setPendingCoverUrl(null);
      await loadTracks();
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  // ── Edit track helpers ──────────────────────────────────────────────────────
  function openEdit(track) {
    setEditTrack(track);
    setEditForm({ title: track.title, description: track.description || '' });
    setEditCoverPreview(track.cover_url || null);
    setEditCoverUrl(null);
    setEditCoverFile(null);
    setEditCoverCleared(false);
    setEditCoverUploading(false);
    setEditError('');
  }

  function closeEdit() {
    setEditTrack(null);
    setEditError('');
    setEditCoverUploading(false);
  }

  async function handleEditCoverSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ok = await looksLikeImage(file);
    if (!ok) { setEditError('Cover must be an image file.'); e.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { setEditError('Cover image too large. Max 5 MB.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = ev => setEditCoverPreview(ev.target.result);
    reader.readAsDataURL(file);
    setEditCoverFile(file);
    setEditCoverCleared(false);
    setEditError('');
    setEditCoverUploading(true);
    try {
      const url = await uploadImage(file);
      setEditCoverUrl(url);
    } catch (err) {
      setEditError('Cover upload failed: ' + err.message);
      setEditCoverPreview(editTrack?.cover_url || null); // revert preview on error
    } finally {
      setEditCoverUploading(false);
    }
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (!editForm.title.trim()) { setEditError('Title cannot be empty.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      const body = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
      };
      if (editCoverUrl) {
        body.cover_url = editCoverUrl; // new cover uploaded
      } else if (editCoverCleared) {
        body.cover_url = null; // explicitly removed
      }
      // if neither, don't include cover_url key → backend keeps existing
      const data = await apiRequest(`/api/music/${editTrack.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setTracks(prev => prev.map(t => t.id === editTrack.id ? { ...t, ...data.track } : t));
      if (currentTrack?.id === editTrack.id) {
        setCurrentTrack(prev => ({ ...prev, ...data.track }));
      }
      closeEdit();
    } catch (err) {
      setEditError(err.message || 'Could not save changes.');
    } finally {
      setEditSaving(false);
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

      {/* Upload form */}
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
            {/* Cover image (optional) */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Cover Image <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional, shown next to track title)</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {coverPreview && (
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                  />
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.tiff,.svg"
                    onChange={handleCoverSelect}
                    style={{ fontSize: 14 }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Max. 5 MB · JPG, PNG, WebP, etc.</div>
                </div>
              </div>
              {coverFile && (
                <button
                  type="button"
                  onClick={() => { setCoverFile(null); setCoverPreview(null); setPendingCoverUrl(null); }}
                  style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 4 }}
                >
                  Remove cover
                </button>
              )}
            </div>
            {uploadError && (
              <div style={{ color: 'var(--danger)', fontSize: 13 }}>{uploadError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowUpload(false); setCoverFile(null); setCoverPreview(null); setPendingCoverUrl(null); setUploadError(''); }}>
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
          {tracks.map((track) => {
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
                {/* Play button */}
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

                {/* Cover thumbnail (if available) */}
                {track.cover_url && (
                  <img
                    src={track.cover_url}
                    alt=""
                    onClick={() => playTrack(track)}
                    style={{
                      width: 40, height: 40, borderRadius: 6,
                      objectFit: 'cover', flexShrink: 0,
                      border: '1px solid var(--border)',
                    }}
                  />
                )}

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

                {/* Download button */}
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

                {/* Edit + Delete (own track or admin) */}
                {user && (isAdmin || track.uploader_id === user.id) && (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(track); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
                      title="Edit track"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteTrack(track.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 6px', borderRadius: 6, fontSize: 16 }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
                      title="Delete track"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Player bar */}
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
            {/* Cover in player bar */}
            {currentTrack.cover_url && (
              <img
                src={currentTrack.cover_url}
                alt=""
                style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
              />
            )}
            {/* Track name */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentTrack.title}
              </div>
              {currentTrack.uploader_username && (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{currentTrack.uploader_username}</div>
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

      {/* ── Edit Modal ───────────────────────────────────────────────────────── */}
      {editTrack && (
        <div
          onClick={closeEdit}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: 28, width: '100%', maxWidth: 460,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Edit Track</h3>
            <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Title *</label>
                <input
                  className="input"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Track title"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea
                  className="input"
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description (optional)"
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Cover Image</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {editCoverPreview && !editCoverCleared ? (
                    <img
                      src={editCoverPreview}
                      alt="Cover"
                      style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 48, height: 48, borderRadius: 6,
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.tiff,.svg"
                      onChange={handleEditCoverSelect}
                      style={{ fontSize: 13 }}
                    />
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Max. 5 MB</div>
                  </div>
                </div>
                {editCoverUploading && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    ⏳ Uploading cover…
                  </div>
                )}
                {(editCoverPreview || editTrack.cover_url) && !editCoverCleared && (
                  <button
                    type="button"
                    onClick={() => { setEditCoverFile(null); setEditCoverPreview(null); setEditCoverUrl(null); setEditCoverCleared(true); }}
                    style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 6 }}
                  >
                    Remove cover image
                  </button>
                )}
              </div>
              {editError && (
                <div style={{ color: 'var(--danger)', fontSize: 13 }}>{editError}</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={editSaving || editCoverUploading}>
                  {editCoverUploading ? 'Uploading cover…' : editSaving ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
