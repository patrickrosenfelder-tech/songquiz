import React, { useState, useEffect } from 'react';
import './App.css';
import GameLobby from './components/GameLobby';
import GameScreen from './components/GameScreen';
import GameOver from './components/GameOver';

function App() {
  const [gameState, setGameState] = useState('lobby');
  const [ws, setWs] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [gameData, setGameData] = useState({
    gameId: null,
    clientId: null,
    userId: null,
    players: [],
    currentRound: 0,
    totalRounds: 10,
    score: 0,
    currentSong: null
  });

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In dev the React server runs separately; otherwise the backend serves this page
    const wsHost = process.env.NODE_ENV === 'development'
      ? `${window.location.hostname}:8080`
      : window.location.host;
    const websocket = new WebSocket(`${protocol}//${wsHost}`);

    websocket.onopen = () => {
      console.log('Connected to server');
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleServerMessage(message);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('Disconnected from server');
      setWs(null);
    };

    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, []);

  const handleServerMessage = (message) => {
    switch (message.type) {
      case 'game-joined':
        setGameData((prev) => ({
          ...prev,
          gameId: message.gameId,
          clientId: message.clientId,
          players: message.gameState.players,
          hostClientId: message.gameState.hostClientId,
          settings: message.gameState.settings,
          genres: message.genres,
          currentRound: message.gameState.currentRound
        }));
        setJoinError(null);
        setGameState('lobby');
        break;

      case 'error':
        setJoinError(message.message);
        break;

      case 'lobby-updated':
        setGameData((prev) => ({
          ...prev,
          players: message.players,
          hostClientId: message.hostClientId,
          settings: message.settings
        }));
        break;

      case 'round-started':
        setGameData((prev) => ({
          ...prev,
          currentRound: message.round,
          totalRounds: message.totalRounds || prev.totalRounds,
          currentSong: message.song,
          answerResult: null,
          roundResult: null
        }));
        setGameState('playing');
        break;

      case 'answer-recorded':
        // Sent only to the player who answered
        setGameData((prev) => ({
          ...prev,
          answerResult: { correct: message.correct, points: message.points },
          score: prev.score + message.points
        }));
        break;

      case 'round-ended':
        setGameData((prev) => {
          const me = message.scores.find((p) => p.clientId === prev.clientId);
          return {
            ...prev,
            score: me ? me.score : prev.score,
            players: message.scores,
            roundResult: {
              correctAnswer: message.correctAnswer,
              artist: message.artist,
              title: message.title,
              isLastRound: message.isLastRound,
              nextIn: message.nextIn
            }
          };
        });
        break;

      case 'game-finished':
        setGameState('gameover');
        setGameData((prev) => ({
          ...prev,
          finalResults: message.results
        }));
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  };

  // Without a game code the server creates a new game with this player as host
  const joinGame = (userId, gameCode) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      setJoinError(null);
      setGameData((prev) => ({ ...prev, userId }));
      ws.send(JSON.stringify({
        type: 'join',
        userId: userId,
        gameId: gameCode || undefined
      }));
    } else {
      setJoinError("Can't reach the game server. Is it running?");
    }
  };

  const submitAnswer = (answer) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'answer',
        answer: answer
      }));
    }
  };

  const updateSettings = (settings) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update-settings', ...settings }));
    }
  };

  const startGame = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ready'
      }));
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Tune<span className="accent">Duel</span></h1>
        <p className="App-tagline">Music trivia with friends</p>
      </header>

      {gameState === 'lobby' && (
        <GameLobby
          onJoin={joinGame}
          onStart={startGame}
          onSettingsChange={updateSettings}
          joinError={joinError}
          gameId={gameData.gameId}
          players={gameData.players}
          clientId={gameData.clientId}
          hostClientId={gameData.hostClientId}
          settings={gameData.settings}
          genres={gameData.genres}
        />
      )}

      {gameState === 'playing' && gameData.currentSong && (
        <GameScreen
          song={gameData.currentSong}
          round={gameData.currentRound}
          totalRounds={gameData.totalRounds}
          score={gameData.score}
          answerResult={gameData.answerResult}
          roundResult={gameData.roundResult}
          onAnswerSubmit={submitAnswer}
        />
      )}

      {gameState === 'gameover' && (
        <GameOver
          finalScore={gameData.score}
          results={gameData.finalResults}
          onRestart={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

export default App;
