/**
 * AudioPlayer — plays a clip with visual feedback
 * Autoplay is triggered by the component mounting (new round).
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  onEnded?: () => void;
  disabled?: boolean;
}

export default function AudioPlayer({ src, onEnded, disabled }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Autoplay when src changes
  useEffect(() => {
    setProgress(0);
    setError(null);
    const audio = audioRef.current;
    if (!audio || disabled) return;
    audio.currentTime = 0;
    audio.play().catch((e) => {
      // Autoplay may be blocked by browser — user can click Play instead
      console.warn('Autoplay blocked:', e.message);
    });
  }, [src, disabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleEnded = () => {
      setPlaying(false);
      setProgress(1);
      onEnded?.();
    };
    const handleTimeUpdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const handleError = () => {
      setError('Could not load clip');
      setPlaying(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
    };
  }, [onEnded]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  };

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={src} preload="auto" />
      {error ? (
        <p className="audio-error">⚠️ {error}</p>
      ) : (
        <>
          <button
            className={`play-btn ${playing ? 'playing' : ''}`}
            onClick={togglePlay}
            disabled={disabled}
            aria-label={playing ? 'Pause clip' : 'Play clip'}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
