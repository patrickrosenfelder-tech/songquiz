import { useState, useEffect } from 'react';
import { AudioPlayer } from './components/AudioPlayer';
import { GuessInput } from './components/GuessInput';
import { ScoreDisplay } from './components/ScoreDisplay';
import { useWebSocket, type WebSocketMessage } from './hooks/useWebSocket';

interface GameState {
  audioUrl?: string;
  songTitle?: string;
  artist?: string;
  score: number;
  guessesTotal: number;
  guessesCorrect: number;
  streak: number;
  feedback?: string;
}

function App() {
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    guessesTotal: 0,
    guessesCorrect: 0,
    streak: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'song_loaded':
        setGameState((prev) => ({
          ...prev,
          audioUrl: message.audio_url as string,
          songTitle: message.song_title as string,
          artist: message.artist as string,
          feedback: undefined,
        }));
        break;

      case 'guess_result':
        const isCorrect = message.correct as boolean;
        setGameState((prev) => ({
          ...prev,
          score: (message.score as number) || prev.score + (isCorrect ? 10 : 0),
          guessesTotal: prev.guessesTotal + 1,
          guessesCorrect: isCorrect ? prev.guessesCorrect + 1 : prev.guessesCorrect,
          streak: (message.streak as number) || (isCorrect ? prev.streak + 1 : 0),
          feedback: isCorrect
            ? `Correct! It was ${prev.songTitle} by ${prev.artist}`
            : `Wrong guess. It was ${prev.songTitle} by ${prev.artist}`,
        }));
        setIsSubmitting(false);
        break;
    }
  };

  const { isConnected, send } = useWebSocket({
    url: wsUrl,
    onMessage: handleWebSocketMessage,
    onConnect: () => setConnectionStatus('connected'),
    onDisconnect: () => setConnectionStatus('disconnected'),
    onError: (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    },
  });

  useEffect(() => {
    if (isConnected) {
      send({ type: 'start_game' });
    }
  }, [isConnected, send]);

  const handleGuess = (guess: string) => {
    setIsSubmitting(true);
    send({ type: 'guess', guess });
  };

  const handleNextSong = () => {
    send({ type: 'next_song' });
  };

  const accuracy = gameState.guessesTotal > 0
    ? (gameState.guessesCorrect / gameState.guessesTotal) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            SongQuiz
          </h1>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full transition-colors ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
              aria-label={`Connection: ${connectionStatus}`}
            />
            <span className="text-sm text-gray-400">{connectionStatus}</span>
          </div>
        </div>
        <p className="text-gray-400">Test your music knowledge by guessing songs</p>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Score Display */}
        <ScoreDisplay
          score={gameState.score}
          accuracy={accuracy}
          streak={gameState.streak}
          feedback={gameState.feedback}
        />

        {/* Audio Player */}
        {gameState.audioUrl && (
          <AudioPlayer audioUrl={gameState.audioUrl} />
        )}

        {/* Guess Input */}
        <GuessInput
          onGuess={handleGuess}
          disabled={!isConnected || !gameState.audioUrl}
          isSubmitting={isSubmitting}
        />

        {/* Next Song Button */}
        {gameState.feedback && (
          <button
            onClick={handleNextSong}
            className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 transition"
          >
            Next Song →
          </button>
        )}

        {/* Connection Alert */}
        {connectionStatus === 'disconnected' && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg p-4">
            <p className="text-red-100">
              ⚠️ Connection lost. Attempting to reconnect...
            </p>
          </div>
        )}

        {connectionStatus === 'connecting' && (
          <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg p-4">
            <p className="text-yellow-100">
              ⏳ Connecting to game server...
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto mt-16 pt-8 border-t border-white border-opacity-10">
        <p className="text-center text-gray-400 text-sm">
          Make sure the backend WebSocket server is running at {wsUrl}
        </p>
      </div>
    </div>
  );
}

export default App;
