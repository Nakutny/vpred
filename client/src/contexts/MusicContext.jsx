import { createContext, useContext, useRef, useState, useCallback } from 'react';

const MusicContext = createContext(null);

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function MusicProvider({ children }) {
  const audioRef = useRef(null);

  const [tracks, setTracks] = useState([]);          // full playlist (set by MusicPage)
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  // Attach event listeners lazily (called once from MusicPage on mount)
  function bindAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.ontimeupdate = () => setProgress(audio.currentTime);
    audio.ondurationchange = () => setDuration(audio.duration || 0);
    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      // auto-advance
      setTracks(prev => {
        setCurrentTrack(cur => {
          const idx = prev.findIndex(t => t.id === cur?.id);
          if (idx >= 0 && idx < prev.length - 1) {
            const next = prev[idx + 1];
            _loadAndPlay(next, audio, prev);
            return next;
          }
          return cur;
        });
        return prev;
      });
    };
  }

  function _loadAndPlay(track, audio, _tracks) {
    audio.src = `${BASE}/api/music/${track.id}/stream`;
    audio.volume = volume;
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    setProgress(0);
    setDuration(0);
  }

  const playTrack = useCallback((track) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      return;
    }

    setCurrentTrack(track);
    _loadAndPlay(track, audio, tracks);
  }, [currentTrack, isPlaying, tracks, volume]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying, currentTrack]);

  const playNext = useCallback(() => {
    const idx = tracks.findIndex(t => t.id === currentTrack?.id);
    if (idx >= 0 && idx < tracks.length - 1) playTrack(tracks[idx + 1]);
  }, [tracks, currentTrack, playTrack]);

  const playPrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setProgress(0);
      return;
    }
    const idx = tracks.findIndex(t => t.id === currentTrack?.id);
    if (idx > 0) playTrack(tracks[idx - 1]);
  }, [tracks, currentTrack, playTrack]);

  const seekTo = useCallback((pct) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = pct * duration;
    setProgress(pct * duration);
  }, [duration]);

  const changeVolume = useCallback((v) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const closePlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ''; }
    setCurrentTrack(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
  }, []);

  return (
    <MusicContext.Provider value={{
      audioRef,
      tracks, setTracks,
      currentTrack, setCurrentTrack,
      isPlaying, setIsPlaying,
      progress, duration,
      volume,
      bindAudio,
      playTrack, togglePlay, playNext, playPrev,
      seekTo, changeVolume, closePlayer,
    }}>
      {/* Single shared <audio> element */}
      <audio ref={audioRef} preload="metadata" />
      {children}
    </MusicContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusicPlayer must be used within MusicProvider');
  return ctx;
}
