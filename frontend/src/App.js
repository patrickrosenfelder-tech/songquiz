import React, { useState, useEffect } from 'react';
import './App.css';
import GameLobby from './components/GameLobby';
import GameScreen from './components/GameScreen';
import GameOver from './components/GameOver';

function App() {
  const [gameState, setGameState] = useState('lobby');
  const [ws, setWs] = useState(null);
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
    const websocket = new WebSocket(`${protocol}//${window.location.hostname}:8080`);

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
          currentRound: message.gameState.currentRound
        }));
        setGameState('lobby');
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

      case 'player-joined':
        // Server only sends the new player's userId; keep players an array of objects
        setGameData((prev) => (
          prev.players.some((p) => p.userId === message.userId)
            ? prev
            : { ...prev, players: [...prev.players, { userId: message.userId, clientId: message.userId, score: 0, ready: false }] }
        ));
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  };

  const joinGame = (userId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      setGameData((prev) => ({ ...prev, userId }));
      ws.send(JSON.stringify({
        type: 'join',
        userId: userId,
        gameId: gameData.gameId || undefined
      }));
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
        <h1>🎵 TuneDuel - Music Trivia</h1>
      </header>

      {gameState === 'lobby' && (
        <GameLobby
          onJoin={joinGame}
          onStart={startGame}
          players={gameData.players}
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
