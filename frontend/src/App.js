import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api } from './api';
import GameLobby from './components/GameLobby';
import SignIn from './components/SignIn';
import DisplayNameSetup from './components/DisplayNameSetup';
import GameScreen from './components/GameScreen';
import GameOver from './components/GameOver';

function App() {
  const [gameState, setGameState] = useState('lobby');
  const [ws, setWs] = useState(null);
  const [joinError, setJoinError] = useState(null);
  // undefined while loading, null when signed out
  const [user, setUser] = useState(undefined);
  const [config, setConfig] = useState(null);
  // Bumped after sign-in/out so the WebSocket reconnects with the new session cookie
  const [connectionKey, setConnectionKey] = useState(0);
  const [gameData, setGameData] = useState({
    gameId: null,
    clientId: null,
    userId: null,
    players: [],
    currentRound: 0,
    totalRounds: 7,
    score: 0,
    currentSong: null
  });

  useEffect(() => {
    api('/config').then(setConfig).catch(() => setConfig({ googleClientId: null, devLogin: false }));
    api('/me').then(({ user }) => setUser(user)).catch(() => setUser(null));
  }, []);

  const handleSignedIn = useCallback((signedInUser) => {
    setUser(signedInUser);
    setConnectionKey((k) => k + 1);
  }, []);

  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    window.google?.accounts?.id?.disableAutoSelect();
    setUser(null);
    setConnectionKey((k) => k + 1);
  };

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
  }, [connectionKey]);

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

  const needsDisplayName = !!user && !user.displayName;

  return (
    <div className="App">
      <header className="App-header">
        <h1>Tune<span className="accent">Duel</span></h1>
        <p className="App-tagline">Music trivia with friends</p>
        {user && user.displayName && (
          <div className="account-bar">
            {user.avatarUrl && <img className="account-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
            <span className="account-name">{user.displayName}</span>
            {gameState === 'lobby' && !gameData.gameId && (
              <button className="link-button" onClick={signOut}>Sign out</button>
            )}
          </div>
        )}
      </header>

      {needsDisplayName && <DisplayNameSetup onSaved={handleSignedIn} onSignOut={signOut} />}

      {!needsDisplayName && user !== undefined && gameState === 'lobby' && (
        <GameLobby
          user={user}
          signIn={<SignIn config={config} onSignedIn={handleSignedIn} />}
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
          isGuest={!user}
          onRestart={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

export default App;
