import React, { useState, useEffect, useCallback } from 'react'
import { AudioPlayer } from './components/AudioPlayer'
import { GuessInput } from './components/GuessInput'
import { ScoreDisplay } from './components/ScoreDisplay'
import { useWebSocket } from './hooks/useWebSocket'

interface GameState {
  audioUrl: string | null
  songTitle: string
  artist: string
  score: number
  total: number
  streak: number
  isLoading: boolean
  message: string
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    audioUrl: null,
    songTitle: '',
    artist: '',
    score: 0,
    total: 0,
    streak: 0,
    isLoading: true,
    message: 'Connecting to server...'
  })

  const [isAudioPlaying, setIsAudioPlaying] = useState(false)

  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
  const { isConnected, send, onMessage } = useWebSocket(wsUrl)

  useEffect(() => {
    if (isConnected) {
      send({ type: 'start_game' })
      setGameState(prev => ({ ...prev, isLoading: false, message: '' }))
    }
  }, [isConnected, send])

  useEffect(() => {
    const unsubscribe = onMessage('song_loaded', (data: unknown) => {
      const songData = data as { audio_url: string; song_title: string; artist: string }
      setGameState(prev => ({
        ...prev,
        audioUrl: songData.audio_url,
        songTitle: songData.song_title,
        artist: songData.artist,
        isLoading: false,
        message: ''
      }))
    })

    return unsubscribe
  }, [onMessage])

  useEffect(() => {
    const unsubscribe = onMessage('guess_result', (data: unknown) => {
      const result = data as {
        correct: boolean
        song_title: string
        artist: string
        score: number
        streak: number
      }

      if (result.correct) {
        setGameState(prev => ({
          ...prev,
          message: `✓ Correct! ${result.song_title} by ${result.artist}`,
          score: result.score,
          streak: result.streak,
          total: prev.total + 1
        }))
      } else {
        setGameState(prev => ({
          ...prev,
          message: `✗ Incorrect. It was ${result.song_title} by ${result.artist}`,
          streak: 0,
          total: prev.total + 1
        }))
      }

      setTimeout(() => {
        send({ type: 'next_song' })
        setGameState(prev => ({
          ...prev,
          audioUrl: null,
          isLoading: true,
          message: 'Loading next song...'
        }))
      }, 2000)
    })

    return unsubscribe
  }, [onMessage, send])

  const handleGuessSubmit = useCallback((guess: string) => {
    send({
      type: 'guess',
      guess: guess
    })
  }, [send])

  const handleAudioEnded = useCallback(() => {
    setIsAudioPlaying(false)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            🎵 SongQuiz
          </h1>
          <p className="text-gray-400">Test your music knowledge</p>
        </div>

        {/* Connection Status */}
        <div className="mb-6 flex items-center justify-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Score Display */}
        <div className="mb-8">
          <ScoreDisplay
            score={gameState.score}
            total={gameState.total}
            streak={gameState.streak}
          />
        </div>

        {/* Main Content */}
        <div className="bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8">
          {gameState.isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-purple-500 rounded-full animate-spin" />
              </div>
              <p className="text-gray-300 mt-4">{gameState.message}</p>
            </div>
          ) : (
            <>
              {/* Audio Player */}
              <div className="mb-8">
                <AudioPlayer
                  audioUrl={gameState.audioUrl}
                  isPlaying={isAudioPlaying}
                  onPlay={() => setIsAudioPlaying(true)}
                  onPause={() => setIsAudioPlaying(false)}
                  onEnded={handleAudioEnded}
                />
              </div>

              {/* Message Display */}
              {gameState.message && (
                <div className={`mb-6 p-4 rounded-lg text-center font-semibold ${
                  gameState.message.startsWith('✓')
                    ? 'bg-green-900 text-green-200'
                    : gameState.message.startsWith('✗')
                    ? 'bg-red-900 text-red-200'
                    : 'bg-blue-900 text-blue-200'
                }`}>
                  {gameState.message}
                </div>
              )}

              {/* Guess Input */}
              <GuessInput
                onSubmit={handleGuessSubmit}
                disabled={!isConnected || gameState.isLoading}
                placeholder="Can you name this song or artist?"
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Listen carefully and guess the song title or artist</p>
        </div>
      </div>
    </div>
  )
}
