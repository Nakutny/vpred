import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { oasis as oasisApi } from '../lib/api';

/* ─── CSS keyframe animations injected once ─────────────────────────────── */
const STYLE = `
@keyframes oasis-water-glow {
  0%   { opacity: 0.18; transform: scale(1);    filter: blur(48px); }
  50%  { opacity: 0.35; transform: scale(1.08); filter: blur(60px); }
  100% { opacity: 0.18; transform: scale(1);    filter: blur(48px); }
}
@keyframes oasis-water-ripple {
  0%   { opacity: 0.06; transform: scale(0.94); filter: blur(32px); }
  50%  { opacity: 0.22; transform: scale(1.06); filter: blur(40px); }
  100% { opacity: 0.06; transform: scale(0.94); filter: blur(32px); }
}
@keyframes oasis-steam-a {
  0%   { opacity: 0;    transform: translateY(0px)    translateX(0px)   scaleX(1);   }
  12%  { opacity: 0.28; }
  75%  { opacity: 0.10; }
  100% { opacity: 0;    transform: translateY(-200px) translateX(-10px) scaleX(1.4); }
}
@keyframes oasis-steam-b {
  0%   { opacity: 0;    transform: translateY(0px)    translateX(0px)  scaleX(1);   }
  12%  { opacity: 0.22; }
  75%  { opacity: 0.08; }
  100% { opacity: 0;    transform: translateY(-180px) translateX(12px) scaleX(1.5); }
}
@keyframes oasis-steam-c {
  0%   { opacity: 0;    transform: translateY(0px)    translateX(0px)   scaleX(1);   }
  12%  { opacity: 0.30; }
  75%  { opacity: 0.12; }
  100% { opacity: 0;    transform: translateY(-240px) translateX(-6px)  scaleX(1.3); }
}
@keyframes oasis-steam-d {
  0%   { opacity: 0;    transform: translateY(0px)    translateX(0px)  scaleX(1);   }
  12%  { opacity: 0.18; }
  75%  { opacity: 0.06; }
  100% { opacity: 0;    transform: translateY(-160px) translateX(16px) scaleX(1.6); }
}
@keyframes oasis-presence-fade {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
}
@keyframes oasis-btn-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(100,180,255,0.55); }
  70%  { box-shadow: 0 0 0 12px rgba(100,180,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(100,180,255,0); }
}
`;

const STEAM_PUFFS = [
  { left: '17%',  bottom: '35%', width: 26, delay: '0s',    dur: '5.8s',  anim: 'oasis-steam-a' },
  { left: '25%',  bottom: '33%', width: 16, delay: '1.3s',  dur: '7.1s',  anim: 'oasis-steam-b' },
  { left: '34%',  bottom: '37%', width: 32, delay: '0.5s',  dur: '6.5s',  anim: 'oasis-steam-c' },
  { left: '42%',  bottom: '39%', width: 20, delay: '2.2s',  dur: '8.0s',  anim: 'oasis-steam-d' },
  { left: '50%',  bottom: '34%', width: 28, delay: '0.9s',  dur: '5.5s',  anim: 'oasis-steam-a' },
  { left: '58%',  bottom: '36%', width: 18, delay: '3.1s',  dur: '7.4s',  anim: 'oasis-steam-b' },
  { left: '66%',  bottom: '38%', width: 24, delay: '1.6s',  dur: '6.2s',  anim: 'oasis-steam-c' },
  { left: '74%',  bottom: '33%', width: 14, delay: '0.3s',  dur: '9.0s',  anim: 'oasis-steam-d' },
  { left: '81%',  bottom: '35%', width: 30, delay: '4.0s',  dur: '5.2s',  anim: 'oasis-steam-a' },
  { left: '29%',  bottom: '42%', width: 12, delay: '2.7s',  dur: '7.8s',  anim: 'oasis-steam-b' },
  { left: '55%',  bottom: '41%', width: 22, delay: '1.1s',  dur: '6.9s',  anim: 'oasis-steam-c' },
  { left: '70%',  bottom: '40%', width: 18, delay: '3.8s',  dur: '8.3s',  anim: 'oasis-steam-d' },
];

export default function OasisPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [presentUsers, setPresentUsers] = useState([]);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const audioRef = useRef(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  /* ── Inject CSS once ── */
  useEffect(() => {
    const id = 'oasis-styles';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = STYLE;
      document.head.appendChild(el);
    }
  }, []);

  /* ── Audio — try to play immediately, stop on unmount ── */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.50;
    audio.loop = true;

    // Try to play right away
    const tryPlay = () => {
      audio.play()
        .then(() => {
          setAudioPlaying(true);
          setNeedsTap(false);
        })
        .catch(() => {
          // Autoplay policy blocked it — show tap button
          setNeedsTap(true);
          setAudioPlaying(false);
        });
    };

    // If already have enough data, play now; otherwise wait for loadeddata
    if (audio.readyState >= 2) {
      tryPlay();
    } else {
      audio.addEventListener('loadeddata', tryPlay, { once: true });
      audio.load(); // explicitly trigger load
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  function handleEnableAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play()
      .then(() => { setAudioPlaying(true); setNeedsTap(false); })
      .catch(() => {});
  }

  function toggleAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setAudioPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setAudioPlaying(false);
    }
  }

  /* ── Presence polling ── */
  useEffect(() => {
    if (!user) return;

    async function fetchPresence() {
      try { const d = await oasisApi.presence(); setPresentUsers(d.users || []); } catch {}
    }
    async function sendPing() {
      try { await oasisApi.ping(); } catch {}
    }

    sendPing(); fetchPresence();
    const pi = setInterval(sendPing, 30_000);
    const fi = setInterval(fetchPresence, 30_000);
    return () => { clearInterval(pi); clearInterval(fi); };
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#080b10', zIndex: 10 }}>

      {/* Hidden audio */}
      <audio ref={audioRef} src="/oasis-ambient.mp3" loop preload="auto" />

      {/* Background image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/oasis-bg.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
        filter: 'brightness(0.80) saturate(1.15)',
      }} />

      {/* Water glow */}
      <div style={{
        position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '72%', height: '20%',
        background: 'radial-gradient(ellipse at center, #1a6aff 0%, #0b38cc 38%, transparent 72%)',
        animation: 'oasis-water-glow 4.5s ease-in-out infinite',
        pointerEvents: 'none', willChange: 'transform, opacity',
      }} />

      {/* Secondary shimmer */}
      <div style={{
        position: 'absolute', bottom: '22%', left: '50%', transform: 'translateX(-50%)',
        width: '46%', height: '12%',
        background: 'radial-gradient(ellipse at center, #5ab8ff 0%, #1f60ff 32%, transparent 68%)',
        animation: 'oasis-water-ripple 3.0s ease-in-out infinite',
        animationDelay: '1.5s',
        pointerEvents: 'none', willChange: 'transform, opacity',
      }} />

      {/* Steam puffs */}
      {STEAM_PUFFS.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.left, bottom: p.bottom,
          width: p.width, height: p.width * 3,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(210,230,255,0.9) 0%, rgba(180,215,255,0.35) 55%, transparent 100%)',
          animation: `${p.anim} ${p.dur} ease-in-out infinite`,
          animationDelay: p.delay,
          pointerEvents: 'none', filter: 'blur(7px)', willChange: 'transform, opacity',
        }} />
      ))}

      {/* Back button */}
      <button onClick={() => navigate(-1)} style={{
        position: 'absolute', top: 20, left: 24,
        background: 'rgba(0,0,0,0.50)', border: '1px solid rgba(255,255,255,0.14)',
        color: 'rgba(255,255,255,0.78)', borderRadius: 8, padding: '7px 14px',
        fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', gap: 6, zIndex: 30,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Leave
      </button>

      {/* Sound button */}
      <button
        onClick={needsTap ? handleEnableAudio : toggleAudio}
        style={{
          position: 'absolute', top: 20, right: 24,
          background: needsTap ? 'rgba(20,70,170,0.70)' : 'rgba(0,0,0,0.50)',
          border: needsTap ? '1px solid rgba(120,190,255,0.55)' : '1px solid rgba(255,255,255,0.14)',
          color: 'rgba(255,255,255,0.88)', borderRadius: 8,
          padding: needsTap ? '9px 18px' : '7px 14px',
          fontSize: needsTap ? 14 : 13,
          fontWeight: needsTap ? 500 : 400,
          cursor: 'pointer', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', gap: 7, zIndex: 30,
          animation: needsTap ? 'oasis-btn-pulse 1.8s ease-in-out infinite' : 'none',
        }}
      >
        {audioPlaying ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        )}
        {needsTap ? 'Tap to enable sound' : audioPlaying ? 'Sound on' : 'Sound off'}
      </button>

      {/* Title */}
      <div style={{
        position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)',
        textAlign: 'center', pointerEvents: 'none', userSelect: 'none',
      }}>
        <div style={{
          fontFamily: 'DM Serif Display, Georgia, serif',
          fontSize: 'clamp(2.8rem, 6vw, 5rem)',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.90)',
          letterSpacing: '0.07em',
          textShadow: '0 2px 40px rgba(40,110,255,0.50), 0 1px 6px rgba(0,0,0,0.80)',
        }}>
          Oasis
        </div>
        <div style={{
          fontSize: 'clamp(0.72rem, 1.4vw, 0.95rem)',
          color: 'rgba(190,215,255,0.50)',
          marginTop: 10,
          letterSpacing: '0.20em',
          textTransform: 'uppercase',
          textShadow: '0 1px 10px rgba(0,0,0,0.70)',
        }}>
          a place to rest
        </div>
      </div>

      {/* Presence bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '18px 24px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'oasis-presence-fade 1.4s ease forwards',
        zIndex: 20,
      }}>
        <div style={{
          fontSize: 13,
          color: 'rgba(190,215,255,0.68)',
          letterSpacing: '0.04em',
          textShadow: '0 1px 8px rgba(0,0,0,0.90)',
        }}>
          {presentUsers.length === 0
            ? 'No one else here right now.'
            : `Currently here: ${presentUsers.join(', ')}`}
        </div>
      </div>
    </div>
  );
}
