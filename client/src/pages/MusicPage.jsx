import { useState, useEffect, useRef } from 'react';
import { music as musicApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// ── Audio Player ──────────────────────────────────────────────────────────────
function AudioPlayer({ src, small }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  }

  function seek(e) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    a.currentTime = (x / rect.width) * duration;
  }

  function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: small ? 8 : 10, width: '100%' }}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={e => setProgress(e.target.currentTime)}
        onDurationChange={e => { setDuration(e.target.duration); setLoaded(true); }}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={toggle}
        style={{
          flexShrink: 0,
          width: small ? 30 : 36, height: small ? 30 : 36,
          borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}
      >
        {playing
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        }
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div
          onClick={seek}
          style={{
            height: 4, background: 'var(--border)', borderRadius: 2, cursor: 'pointer', position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: duration ? `${(progress / duration) * 100}%` : '0%',
            background: 'var(--accent)', borderRadius: 2, transition: 'width 0.1s',
          }} />
        </div>
        {!small && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
            <span>{fmt(progress)}</span>
            <span>{loaded ? fmt(duration) : '—'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Upload Form ───────────────────────────────────────────────────────────────
function UploadForm({ onUploaded }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  function handleFile(e) {
    setError('');
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.mp3')) { setError('Only MP3 files allowed.'); return; }
    if (f.size > MAX_SIZE_BYTES) { setError(`File too large — max ${MAX_SIZE_MB} MB.`); return; }
    setFile(f);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!file) { setError('Please select an MP3 file.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const fileData = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = ev => res(ev.target.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const d = await musicApi.upload({ name, description, fileData, filename: file.name, fileSize: file.size });
      onUploaded(d.track);
      setName(''); setDescription(''); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ padding: '22px 24px', marginBottom: 32 }}>
      <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.15rem', fontWeight: 400, marginBottom: 18 }}>Upload a Track</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Name *</label>
            <input className="input" placeholder="Track name…" value={name} onChange={e => setName(e.target.value)} maxLength={150} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>MP3 File *</label>
            <input ref={fileRef} type="file" accept=".mp3,audio/mpeg" onChange={handleFile} className="input" style={{ paddingTop: 7 }} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Description <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
          <textarea className="input" style={{ minHeight: 64, resize: 'vertical' }} placeholder="A short description…" value={description} onChange={e => setDescription(e.target.value)} maxLength={500} />
        </div>
        {file && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            📎 {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
          </div>
        )}
        {error && <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? 'Uploading…' : 'Upload Track'}
        </button>
      </form>
    </div>
  );
}

// ── Version Upload Form ───────────────────────────────────────────────────────
function VersionUploadForm({ trackId, onUploaded, onClose }) {
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  function handleFile(e) {
    setError('');
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.mp3')) { setError('Only MP3 files allowed.'); return; }
    if (f.size > MAX_SIZE_BYTES) { setError(`File too large — max ${MAX_SIZE_MB} MB.`); return; }
    setFile(f);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) { setError('Label is required.'); return; }
    if (!file) { setError('Please select an MP3 file.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const fileData = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = ev => res(ev.target.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const d = await musicApi.addVersion(trackId, { label, fileData, filename: file.name, fileSize: file.size });
      onUploaded(d.version);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 12, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Version label *</label>
            <input className="input" style={{ fontSize: 13 }} placeholder='e.g. "Slowed", "Super Slowed"' value={label} onChange={e => setLabel(e.target.value)} maxLength={80} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>MP3 File *</label>
            <input ref={fileRef} type="file" accept=".mp3,audio/mpeg" onChange={handleFile} className="input" style={{ fontSize: 12, paddingTop: 7 }} />
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
            {submitting ? 'Uploading…' : 'Add Version'}
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

// ── Track Card ────────────────────────────────────────────────────────────────
function TrackCard({ track, currentUser, isAdmin, onDelete, onVersionAdded, onVersionDeleted }) {
  const [showVersionForm, setShowVersionForm] = useState(false);
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const canDelete = currentUser && (currentUser.id === track.uploader_id || isAdmin);
  const canAddVersion = currentUser && (currentUser.id === track.uploader_id || isAdmin);

  return (
    <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
        <div>
          <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', fontWeight: 400, marginBottom: 2 }}>{track.name}</h3>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            by {track.uploader_username} · {(track.file_size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <a
            href={`${BASE}/api/music/${track.id}/file`}
            download={track.filename}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12 }}
          >
            ↓ Download
          </a>
          {canDelete && (
            <button onClick={() => onDelete(track.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 12 }}>
              Delete
            </button>
          )}
        </div>
      </div>

      {track.description && (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>{track.description}</p>
      )}

      {/* Main player */}
      <AudioPlayer src={`${BASE}/api/music/${track.id}/file`} />

      {/* Versions */}
      {track.versions && track.versions.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Versions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {track.versions.map(v => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                  background: 'rgba(79,142,247,0.1)', padding: '2px 8px', borderRadius: 20,
                  flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  {v.label}
                </span>
                <div style={{ flex: 1 }}>
                  <AudioPlayer src={`${BASE}/api/music/${track.id}/version/${v.id}/file`} small />
                </div>
                <a
                  href={`${BASE}/api/music/${track.id}/version/${v.id}/file`}
                  download={v.filename}
                  style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}
                >
                  ↓
                </a>
                {(currentUser?.id === track.uploader_id || isAdmin) && (
                  <button
                    onClick={() => onVersionDeleted(track.id, v.id)}
                    style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add version */}
      {canAddVersion && (
        <div style={{ marginTop: 12 }}>
          {showVersionForm
            ? <VersionUploadForm
                trackId={track.id}
                onUploaded={v => onVersionAdded(track.id, v)}
                onClose={() => setShowVersionForm(false)}
              />
            : <button onClick={() => setShowVersionForm(true)} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                + Add version
              </button>
          }
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MusicPage() {
  const { user, isAdmin } = useAuth();
  const [tracks, setTracks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    musicApi.list().then(d => {
      setTracks(d.tracks || []);
      setTotal(d.total || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function handleUploaded(track) {
    setTracks(prev => [{ ...track, versions: [], uploader_username: user.username }, ...prev]);
    setTotal(t => t + 1);
  }

  async function handleDelete(trackId) {
    if (!confirm('Delete this track?')) return;
    try {
      await musicApi.delete(trackId);
      setTracks(prev => prev.filter(t => t.id !== trackId));
      setTotal(t => t - 1);
    } catch (err) {
      alert(err.message);
    }
  }

  function handleVersionAdded(trackId, version) {
    setTracks(prev => prev.map(t =>
      t.id === trackId ? { ...t, versions: [...(t.versions || []), version] } : t
    ));
  }

  async function handleVersionDeleted(trackId, versionId) {
    if (!confirm('Delete this version?')) return;
    try {
      await musicApi.deleteVersion(trackId, versionId);
      setTracks(prev => prev.map(t =>
        t.id === trackId ? { ...t, versions: t.versions.filter(v => v.id !== versionId) } : t
      ));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 400, lineHeight: 1.15, marginBottom: 10 }}>
          Selfmade Music
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 15, maxWidth: 480 }}>
          Share your own music — original tracks, versions, and experiments.
        </p>
      </div>

      {user && <UploadForm onUploaded={handleUploaded} />}

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
      ) : tracks.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
          No tracks yet. {user ? 'Be the first to upload!' : 'Sign in to upload.'}
        </div>
      ) : (
        tracks.map(track => (
          <TrackCard
            key={track.id}
            track={track}
            currentUser={user}
            isAdmin={isAdmin}
            onDelete={handleDelete}
            onVersionAdded={handleVersionAdded}
            onVersionDeleted={handleVersionDeleted}
          />
        ))
      )}
    </div>
  );
}
