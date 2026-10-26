import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { oasis as oasisApi } from '../lib/api';

/* ─── CSS keyframe animations injected once ─────────────────────────────── */
const STYLE = `
@keyframes oasis-water-glow {
  0%   { opacity: 0.18; transform: scale(1);     filter: blur(48px); }
  50%  { opacity: 0.32; transform: scale(1.06);  filter: blur(56px); }
  100% { opacity: 0.18; transform: scale(1);     filter: blur(48px); }
}
@keyframes oasis-water-ripple {
  0%   { opacity: 0.07; transform: scale(0.95); }
  50%  { opacity: 0.18; transform: scale(1.04); }
  100% { opacity: 0.07; transform: scale(0.95); }
}
@keyframes oasis-steam-rise {
  0%   { transform: translateY(0)   translateX(0)   scaleX(1);   opacity: 0;    }
  10%  { opacity: 0.22; }
  80%  { opacity: 0.12; }
  100% { transform: translateY(-220px) translateX(var(--sx, 0px)) scaleX(1.3); opacity: 0; }
}
@keyframes oasis-presence-fade {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0);   }
}
`;

/* ─── Steam puffs config ─────────────────────────────────────────────────── */
const STEAM_PUFFS = [
  { left: '18%',  bottom: '36%', width: 28, delay: '0s',    dur: '5.5s',  sx: '-8px'  },
  { left: '27%',  bottom: '34%', width: 18, delay: '1.2s',  dur: '6.8s',  sx: '4px'   },
  { left: '38%',  bottom: '38%', width: 34, delay: '0.4s',  dur: '7.2s',  sx: '-12px' },
  { left: '50%',  bottom: '35%', width: 22, delay: '2.1s',  dur: '5.9s',  sx: '10px'  },
  { left: '61%',  bottom: '37%', width: 30, delay: '0.8s',  dur: '6.4s',  sx: '-6px'  },
  { left: '72%',  bottom: '33%', width: 20, delay: '1.7s',  dur: '7.8s',  sx: '14px'  },
  { left: '81%',  bottom: '36%', width: 16, delay: '3.0s',  dur: '5.2s',  sx: '-4px'  },
  { left: '44%',  bottom: '40%', width: 26, delay: '1.5s',  dur: '8.1s',  sx: '6px'   },
  { left: '55%',  bottom: '32%', width: 14, delay: '2.8s',  dur: '6.0s',  sx: '-10px' },
  { left: '32%',  bottom: '42%', width: 20, delay: '4.0s',  dur: '7.5s',  sx: '8px'   },
  { left: '65%',  bottom: '41%', width: 24, delay: '0.2s',  dur: '9.0s',  sx: '-16px' },
  { left: '23%',  bottom: '43%', width: 12, delay: '3.5s',  dur: '6.7s',  sx: '2px'   },
];

export default function OasisPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [presentUsers, setPresentUsers] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  /* ── Auth guard — redirect non-logged-in users ── */
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
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
    return () => {};
  }, []);

  /* ── Presence polling ── */
  useEffect(() => {
    if (!user) return;

    async function fetchPresence() {
      try {
        const data = await oasisApi.presence();
        setPresentUsers(data.users || []);
      } catch {}
    }

    async function sendPing() {
      try { await oasisApi.ping(); } catch {}
    }

    // Initial ping + fetch
    sendPing();
    fetchPresence();

    const pingInterval = setInterval(sendPing, 30_000);
    const fetchInterval = setInterval(fetchPresence, 30_000);

    return () => {
      clearInterval(pingInterval);
      clearInterval(fetchInterval);
    };
  }, [user]);

  /* ── Autoplay audio ── */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    audio.loop = true;
    audio.play()
      .then(() => setAudioEnabled(true))
      .catch(() => {
        // Autoplay blocked — show tap-to-enable button
        setAudioEnabled(false);
      });
  }, []);

  function handleEnableAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play()
      .then(() => setAudioEnabled(true))
      .catch(() => setAudioError(true));
  }

  function toggleAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setAudioEnabled(true)).catch(() => {});
    } else {
      audio.pause();
      setAudioEnabled(false);
    }
  }

  if (authLoading || !user) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      background: '#0a0d12',
      zIndex: 10,
    }}>
      {/* ─── Background image ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/oasis-bg.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness(0.82) saturate(1.1)',
      }} />

      {/* ─── Water glow overlay — large pulsing blue orb ──────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: '22%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '70%',
        height: '22%',
        background: 'radial-gradient(ellipse at center, #1a6aff 0%, #0d3dcc 40%, transparent 75%)',
        animation: 'oasis-water-glow 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* ─── Secondary shimmer (offset phase) ────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: '24%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '45%',
        height: '14%',
        background: 'radial-gradient(ellipse at center, #4fb3ff 0%, #2266ff 35%, transparent 70%)',
        animation: 'oasis-water-ripple 3.2s ease-in-out infinite',
        animationDelay: '1.6s',
        pointerEvents: 'none',
      }} />

      {/* ─── Steam puffs ──────────────────────────────────────────────────── */}
      {STEAM_PUFFS.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.left,
            bottom: p.bottom,
            width: p.width,
            height: p.width * 2.5,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(200,220,255,0.85) 0%, rgba(180,210,255,0.3) 60%, transparent 100%)',
            animation: `oasis-steam-rise ${p.dur} ease-in-out infinite`,
            animationDelay: p.delay,
            '--sx': p.sx,
            pointerEvents: 'none',
            filter: 'blur(6px)',
          }}
        />
      ))}

      {/* ─── Audio element ────────────────────────────────────────────────── */}
      <audio ref={audioRef} src="/oasis-ambient.mp3" loop preload="auto" />

      {/* ─── Back button ──────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'absolute',
          top: 20,
          left: 24,
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.75)',
          borderRadius: 8,
          padding: '7px 14px',
          fontSize: 13,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'background 0.15s',
          zIndex: 20,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.65)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.45)'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Leave
      </button>

      {/* ─── Audio toggle button ──────────────────────────────────────────── */}
      <button
        onClick={audioEnabled ? toggleAudio : handleEnableAudio}
        title={audioEnabled ? 'Mute ambient sound' : 'Enable ambient sound'}
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.75)',
          borderRadius: 8,
          padding: '7px 14px',
          fontSize: 13,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'background 0.15s',
          zIndex: 20,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.65)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.45)'}
      >
        {audioEnabled ? (
          /* Speaker on */
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        ) : (
          /* Speaker off */
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        )}
        {audioEnabled ? 'Sound on' : 'Enable sound'}
      </button>

      {/* ─── Oasis title ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        <div style={{
          fontFamily: 'DM Serif Display, Georgia, serif',
          fontSize: 'clamp(2.5rem, 6vw, 5rem)',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.88)',
          letterSpacing: '0.06em',
          textShadow: '0 2px 32px rgba(30,100,255,0.45), 0 1px 4px rgba(0,0,0,0.7)',
          lineHeight: 1.1,
        }}>
          Oasis
        </div>
        <div style={{
          fontSize: 'clamp(0.75rem, 1.5vw, 1rem)',
          color: 'rgba(200,220,255,0.55)',
          marginTop: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          textShadow: '0 1px 8px rgba(0,0,0,0.6)',
        }}>
          a place to rest
        </div>
      </div>

      {/* ─── Presence bar ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '14px 24px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'oasis-presence-fade 1.2s ease forwards',
        zIndex: 20,
      }}>
        <div style={{
          fontSize: 13,
          color: 'rgba(200,220,255,0.7)',
          letterSpacing: '0.03em',
          textShadow: '0 1px 6px rgba(0,0,0,0.8)',
        }}>
          {presentUsers.length === 0
            ? 'No one else here right now.'
            : `Currently here: ${presentUsers.join(', ')}`
          }
        </div>
      </div>
    </div>
  );
}
