import React, { useRef, useState, useEffect } from 'react'

interface AudioPlayerProps {
  audioUrl: string | null
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onEnded: () => void
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  isPlaying,
  onPlay,
  onPause,
  onEnded
}) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', onEnded)
    }
  }, [onEnded])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.play().catch(error => console.error('Play failed:', error))
      onPlay()
    } else {
      audio.pause()
      onPause()
    }
  }, [isPlaying, onPlay, onPause])

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(error => console.error('Play failed:', error))
      } else {
        audioRef.current.pause()
      }
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!audioUrl) {
    return (
      <div className="w-full bg-gray-100 rounded-lg p-6 text-center">
        <p className="text-gray-500">No audio available</p>
      </div>
    )
  }

  return (
    <div className="w-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white shadow-lg">
      <audio ref={audioRef} src={audioUrl} />

      <div className="flex items-center justify-center mb-4">
        <button
          onClick={handlePlayPause}
          className="bg-white text-blue-600 rounded-full p-4 hover:bg-gray-100 transition-colors shadow-md"
          aria-label={audioRef.current?.paused ? 'Play' : 'Pause'}
        >
          {audioRef.current?.paused ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 4a2 2 0 01-2 2h-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v2H6a2 2 0 01-2-2V2a2 2 0 012-2h10a2 2 0 012 2v2zM14 7H2v9a2 2 0 002 2h8a2 2 0 002-2V7zM4 9a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V9z" clipRule="evenodd" />
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
          className="w-full h-2 bg-white rounded-lg appearance-none cursor-pointer"
          aria-label="Seek audio"
        />

        <div className="flex justify-between text-sm font-semibold">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  )
}
