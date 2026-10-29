import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { oasis as oasisApi } from '../lib/api';

const R2 = 'https://pub-20f8658196ed4d898146c9bebcb0fb3b.r2.dev';

/* ─── CSS keyframe animations ────────────────────────────────────────────── */
const STYLE = `
@keyframes oasis-water-glow {
  0%   { opacity: 0.18; transform: translateX(-50%) scale(1);    filter: blur(48px); }
  50%  { opacity: 0.32; transform: translateX(-50%) scale(1.07); filter: blur(56px); }
  100% { opacity: 0.18; transform: translateX(-50%) scale(1);    filter: blur(48px); }
}
@keyframes oasis-water-ripple {
  0%   { opacity: 0.06; transform: translateX(-50%) scale(0.95); filter: blur(32px); }
  50%  { opacity: 0.20; transform: translateX(-50%) scale(1.05); filter: blur(38px); }
  100% { opacity: 0.06; transform: translateX(-50%) scale(0.95); filter: blur(32px); }
}
@keyframes oasis-steam-a {
  0%   { opacity: 0;    transform: translateY(0px)    translateX(0px)   scaleX(1);   }
  12%  { opacity: 0.22; }
  75%  { opacity: 0.08; }
  100% { opacity: 0;    transform: translateY(-220px) translateX(-12px) scaleX(1.5); }
}
@keyframes oasis-steam-b {
  0%   { opacity: 0;    transform: translateY(0px)    translateX(0px)  scaleX(1);   }
  12%  { opacity: 0.18; }
  75%  { opacity: 0.06; }
  100% { opacity: 0;    transform: translateY(-190px) translateX(14px) scaleX(1.6); }
}
@keyframes oasis-steam-c {
  0%   { opacity: 0;    transform: translateY(0px)    translateX(0px)   scaleX(1);   }
  12%  { opacity: 0.25; }
  75%  { opacity: 0.09; }
  100% { opacity: 0;    transform: translateY(-260px) translateX(-8px)  scaleX(1.4); }
}
@keyframes oasis-steam-d {
  0%   { opacity: 0;    transform: translateY(0px)    translateX(0px)  scaleX(1);   }
  12%  { opacity: 0.14; }
  75%  { opacity: 0.05; }
  100% { opacity: 0;    transform: translateY(-170px) translateX(18px) scaleX(1.7); }
}
/* Wide slow mist layers */
@keyframes oasis-mist-l {
  0%   { opacity: 0.07; transform: translateX(-8%); }
  50%  { opacity: 0.14; transform: translateX(2%);  }
  100% { opacity: 0.07; transform: translateX(-8%); }
}
@keyframes oasis-mist-r {
  0%   { opacity: 0.09; transform: translateX(6%);  }
  50%  { opacity: 0.16; transform: translateX(-4%); }
  100% { opacity: 0.09; transform: translateX(6%);  }
}
/* Caustic light reflections */
@keyframes oasis-caustic-a {
  0%   { opacity: 0; transform: rotate(0deg)   scaleX(1);   }
  20%  { opacity: 0.18; }
  80%  { opacity: 0.08; }
  100% { opacity: 0; transform: rotate(12deg)  scaleX(1.3); }
}
@keyframes oasis-caustic-b {
  0%   { opacity: 0; transform: rotate(0deg)   scaleX(1);   }
  25%  { opacity: 0.14; }
  75%  { opacity: 0.06; }
  100% { opacity: 0; transform: rotate(-8deg)  scaleX(1.2); }
}
@keyframes oasis-caustic-c {
  0%   { opacity: 0; transform: rotate(0deg)  scaleX(1);   }
  30%  { opacity: 0.20; }
  70%  { opacity: 0.10; }
  100% { opacity: 0; transform: rotate(5deg)  scaleX(1.4); }
}
/* Vignette pulse — room breathing */
@keyframes oasis-vignette {
  0%   { opacity: 0.55; }
  50%  { opacity: 0.75; }
  100% { opacity: 0.55; }
}
/* Color temperature overlay — warm ↔ cool */
@keyframes oasis-warmth {
  0%   { opacity: 0.04; }
  50%  { opacity: 0.10; }
  100% { opacity: 0.04; }
}
/* Depth-haze overlay */
@keyframes oasis-haze {
  0%   { opacity: 0.08; }
  50%  { opacity: 0.18; }
  100% { opacity: 0.08; }
}
/* Floating particles */
@keyframes oasis-particle {
  0%   { opacity: 0;    transform: translateY(0px)   translateX(0px); }
  15%  { opacity: 0.6; }
  85%  { opacity: 0.2; }
  100% { opacity: 0;    transform: translateY(-120px) translateX(var(--px, 8px)); }
}
@keyframes oasis-presence-fade {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
}
@keyframes oasis-btn-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(100,180,255,0.55); }
  70%  { box-shadow: 0 0 0 14px rgba(100,180,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(100,180,255,0); }
}
`;

const STEAM_PUFFS = [
  { left: '14%', bottom: '34%', width: 28, delay: '0s',   dur: '8.5s',  anim: 'oasis-steam-a' },
  { left: '22%', bottom: '32%', width: 18, delay: '1.8s', dur: '10.2s', anim: 'oasis-steam-b' },
  { left: '31%', bottom: '36%', width: 34, delay: '0.7s', dur: '9.1s',  anim: 'oasis-steam-c' },
  { left: '40%', bottom: '38%', width: 22, delay: '3.0s', dur: '11.5s', anim: 'oasis-steam-d' },
  { left: '49%', bottom: '33%', width: 30, delay: '1.2s', dur: '8.0s',  anim: 'oasis-steam-a' },
  { left: '57%', bottom: '35%', width: 20, delay: '4.2s', dur: '10.8s', anim: 'oasis-steam-b' },
  { left: '65%', bottom: '37%', width: 26, delay: '2.1s', dur: '9.6s',  anim: 'oasis-steam-c' },
  { left: '73%', bottom: '32%', width: 16, delay: '0.4s', dur: '12.0s', anim: 'oasis-steam-d' },
  { left: '80%', bottom: '34%', width: 32, delay: '5.3s', dur: '7.8s',  anim: 'oasis-steam-a' },
  { left: '27%', bottom: '41%', width: 14, delay: '3.6s', dur: '11.2s', anim: 'oasis-steam-b' },
  { left: '53%', bottom: '40%', width: 24, delay: '1.5s', dur: '9.9s',  anim: 'oasis-steam-c' },
  { left: '68%', bottom: '39%', width: 20, delay: '5.0s', dur: '12.5s', anim: 'oasis-steam-d' },
];

const CAUSTICS = [
  { left: '18%', bottom: '30%', w: 80,  h: 6,  delay: '0s',   dur: '6.2s',  anim: 'oasis-caustic-a' },
  { left: '35%', bottom: '28%', w: 120, h: 5,  delay: '1.4s', dur: '8.1s',  anim: 'oasis-caustic-b' },
  { left: '52%', bottom: '31%', w: 90,  h: 7,  delay: '0.8s', dur: '5.5s',  anim: 'oasis-caustic-c' },
  { left: '67%', bottom: '27%', w: 60,  h: 4,  delay: '2.2s', dur: '7.3s',  anim: 'oasis-caustic-a' },
  { left: '78%', bottom: '29%', w: 100, h: 6,  delay: '3.5s', dur: '6.8s',  anim: 'oasis-caustic-b' },
  { left: '42%', bottom: '33%', w: 70,  h: 5,  delay: '1.0s', dur: '9.0s',  anim: 'oasis-caustic-c' },
];

const PARTICLES = [
  { left: '20%', bottom: '32%', delay: '0s',   dur: '7s',  dx: '6px'  },
  { left: '38%', bottom: '30%', delay: '1.5s', dur: '9s',  dx: '-8px' },
  { left: '55%', bottom: '33%', delay: '0.5s', dur: '6s',  dx: '10px' },
  { left: '71%', bottom: '31%', delay: '2.8s', dur: '8s',  dx: '-5px' },
  { left: '29%', bottom: '35%', delay: '4.0s', dur: '7.5s',dx: '7px'  },
  { left: '62%', bottom: '34%', delay: '1.0s', dur: '10s', dx: '-9px' },
  { left: '45%', bottom: '29%', delay: '3.2s', dur: '6.5s',dx: '4px'  },
  { left: '83%', bottom: '32%', delay: '0.8s', dur: '8.5s',dx: '-6px' },
];

export default function OasisPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [presentUsers, setPresentUsers] = useState([]);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const audioRef = useRef(null);
  const heartRef = useRef(null);
  const containerRef = useRef(null);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

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

  /* ── Audio — main ambient + heartbeat ── */
  useEffect(() => {
    if (!user) return;
    const audio = audioRef.current;
    const heart = heartRef.current;
    if (!audio || !heart) return;

    audio.src = `${R2}/vpredoasis_2.mp3`;
    audio.volume = 0.50;
    audio.loop = true;
    audio.load();

    heart.src = `${R2}/vpredoasis_heartbeat.mp3`;
    heart.volume = 0.18;
    heart.loop = true;
    heart.load();

    return () => {
      audio.pause(); audio.currentTime = 0;
      heart.pause(); heart.currentTime = 0;
    };
  }, [user]);

  function handleEnableAudio() {
    const audio = audioRef.current;
    const heart = heartRef.current;
    if (!audio) return;
    audio.play()
      .then(() => {
        setAudioPlaying(true);
        setNeedsTap(false);
        heart?.play().catch(() => {});
      })
      .catch(() => {});
  }

  function toggleAudio() {
    const audio = audioRef.current;
    const heart = heartRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => {
        setAudioPlaying(true);
        heart?.play().catch(() => {});
      }).catch(() => {});
    } else {
      audio.pause();
      heart?.pause();
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
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#080b10', zIndex: 10 }}>

      {/* Audio elements */}
      <audio ref={audioRef} preload="none" />
      <audio ref={heartRef} preload="none" />

      {/* Background image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${R2}/vpredoasis.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
        filter: 'brightness(0.78) saturate(1.1)',
      }} />

      {/* Vignette — breathing pulse */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.82) 100%)',
        animation: 'oasis-vignette 7s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Color temperature — warm amber pulse */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 60%, rgba(255,180,80,0.18) 0%, transparent 65%)',
        animation: 'oasis-warmth 11s ease-in-out infinite',
        animationDelay: '3s',
        pointerEvents: 'none',
      }} />

      {/* Depth haze — cool blue overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 20%, rgba(60,120,255,0.12) 0%, transparent 60%)',
        animation: 'oasis-haze 9s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Wide mist layer left */}
      <div style={{
        position: 'absolute', bottom: '25%', left: '-10%', width: '70%', height: '18%',
        background: 'radial-gradient(ellipse at center, rgba(200,225,255,0.22) 0%, transparent 70%)',
        filter: 'blur(28px)',
        animation: 'oasis-mist-l 14s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Wide mist layer right */}
      <div style={{
        position: 'absolute', bottom: '22%', right: '-10%', width: '65%', height: '16%',
        background: 'radial-gradient(ellipse at center, rgba(180,215,255,0.20) 0%, transparent 70%)',
        filter: 'blur(32px)',
        animation: 'oasis-mist-r 17s ease-in-out infinite',
        animationDelay: '4s',
        pointerEvents: 'none',
      }} />

      {/* Water glow */}
      <div style={{
        position: 'absolute', bottom: '20%', left: '50%',
        width: '72%', height: '20%',
        background: 'radial-gradient(ellipse at center, #1a6aff 0%, #0b38cc 38%, transparent 72%)',
        animation: 'oasis-water-glow 6s ease-in-out infinite',
        pointerEvents: 'none', willChange: 'transform, opacity',
      }} />

      {/* Secondary shimmer */}
      <div style={{
        position: 'absolute', bottom: '22%', left: '50%',
        width: '46%', height: '12%',
        background: 'radial-gradient(ellipse at center, #5ab8ff 0%, #1f60ff 32%, transparent 68%)',
        animation: 'oasis-water-ripple 4.5s ease-in-out infinite',
        animationDelay: '2s',
        pointerEvents: 'none', willChange: 'transform, opacity',
      }} />

      {/* Caustic light reflections */}
      {CAUSTICS.map((c, i) => (
        <div key={i} style={{
          position: 'absolute', left: c.left, bottom: c.bottom,
          width: c.w, height: c.h,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(180,230,255,0.95) 0%, rgba(120,190,255,0.4) 50%, transparent 100%)',
          filter: 'blur(3px)',
          animation: `${c.anim} ${c.dur} ease-in-out infinite`,
          animationDelay: c.delay,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Steam puffs */}
      {STEAM_PUFFS.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.left, bottom: p.bottom,
          width: p.width, height: p.width * 3.5,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(210,230,255,0.85) 0%, rgba(180,215,255,0.30) 55%, transparent 100%)',
          animation: `${p.anim} ${p.dur} ease-in-out infinite`,
          animationDelay: p.delay,
          pointerEvents: 'none', filter: 'blur(9px)', willChange: 'transform, opacity',
        }} />
      ))}

      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.left, bottom: p.bottom,
          width: 3, height: 3, borderRadius: '50%',
          background: 'rgba(180,225,255,0.85)',
          filter: 'blur(1px)',
          animation: `oasis-particle ${p.dur} ease-in-out infinite`,
          animationDelay: p.delay,
          '--px': p.dx,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Leave button */}
      <button onClick={() => navigate(-1)} style={{
        position: 'absolute', top: 72, left: 24,
        background: 'rgba(0,0,0,0.50)', border: '1px solid rgba(255,255,255,0.14)',
        color: 'rgba(255,255,255,0.78)', borderRadius: 8, padding: '7px 14px',
        fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', gap: 6, zIndex: 30,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Leave Vpred completely
      </button>

      {/* Sound button */}
      <button
        onClick={needsTap ? handleEnableAudio : toggleAudio}
        style={{
          position: 'absolute', top: 72, right: 24,
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

      {/* Fullscreen button */}
      <button onClick={toggleFullscreen} style={{
        position: 'absolute', bottom: 68, right: 24,
        background: 'rgba(0,0,0,0.50)', border: '1px solid rgba(255,255,255,0.14)',
        color: 'rgba(255,255,255,0.78)', borderRadius: 8, padding: '7px 14px',
        fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', gap: 6, zIndex: 30,
      }}>
        {isFullscreen ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        )}
        {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      </button>

      {/* Presence bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '18px 24px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.80))',
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
