import { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  audioUrl?: string;
  onPlay?: () => void;
  onPause?: () => void;
}

export function AudioPlayer({ audioUrl, onPlay, onPause }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl || '';
    }
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      onPause?.();
    } else {
      audio.play();
      setIsPlaying(true);
      onPlay?.();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 shadow-lg">
      <audio ref={audioRef} />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Now Playing</h3>
        <button
          onClick={togglePlayPause}
          disabled={!audioUrl}
          className="bg-white text-purple-600 rounded-full p-3 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5.75 1.5h2.5v17h-2.5V1.5zm6.5 0h2.5v17h-2.5V1.5z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3.5 2.75A1.75 1.75 0 015.25 1h10.5c.966 0 1.75.784 1.75 1.75v14.5c0 .966-.784 1.75-1.75 1.75H5.25A1.75 1.75 0 013.5 17.25V2.75zm1.4 0v14.5c0 .193.157.35.35.35h10.5c.193 0 .35-.157.35-.35V2.75c0-.193-.157-.35-.35-.35H5.25c-.193 0-.35.157-.35.35z" />
            </svg>
          )}
        </button>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          disabled={!audioUrl}
          className="w-full h-2 bg-white bg-opacity-30 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Seek"
        />

        <div className="flex justify-between text-white text-sm">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
