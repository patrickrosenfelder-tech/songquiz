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
          currentSong: message.song
        }));
        setGameState('playing');
        break;

      case 'answer-recorded':
        if (message.correct) {
          setGameData((prev) => ({
            ...prev,
            score: prev.score + message.points
          }));
        }
        break;

      case 'game-finished':
        setGameState('gameover');
        setGameData((prev) => ({
          ...prev,
          finalResults: message.results
        }));
        break;

      case 'player-joined':
        // Only a count arrives here; keep `players` an array of Player objects
        setGameData((prev) => ({
          ...prev,
          playerCount: message.totalPlayers
        }));
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
        answer: answer,
        timeSpent: 0
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
          playerCount={gameData.playerCount}
        />
      )}

      {gameState === 'playing' && gameData.currentSong && (
        <GameScreen
          song={gameData.currentSong}
          round={gameData.currentRound}
          totalRounds={gameData.totalRounds}
          score={gameData.score}
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
