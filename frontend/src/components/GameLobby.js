import React, { useState } from 'react';
import './GameLobby.css';

const MODES = [
  { id: 'artist', label: 'Artist' },
  { id: 'title', label: 'Title' },
  { id: 'mix', label: 'Mix' }
];

function GameLobby({
  onJoin,
  onStart,
  onSettingsChange,
  players = [],
  clientId,
  hostClientId,
  settings,
  genres = []
}) {
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);

  const isHost = !!clientId && clientId === hostClientId;
  const me = players.find((p) => p.clientId === clientId);
  const isReady = !!me && me.ready;
  const allReady = players.length > 0 && players.every((p) => p.ready);
  const genreName = (genres.find((g) => g.id === settings?.genreId) || {}).name || 'All';
  const modeLabel = (MODES.find((m) => m.id === settings?.mode) || MODES[0]).label;

  const handleJoin = () => {
    if (username.trim()) {
      onJoin(username);
      setJoined(true);
    }
  };

  const handleStart = () => {
    onStart();
  };

  const renderSettings = () => {
    if (!settings) return null;

    if (!isHost) {
      return (
        <div className="settings-section">
          <p className="settings-summary">
            Genre: <strong>{genreName}</strong> · Guess: <strong>{modeLabel}</strong>
          </p>
          <p className="settings-hint">The host picks the genre and what to guess.</p>
        </div>
      );
    }

    return (
      <div className="settings-section">
        <label className="settings-label" htmlFor="genre-select">Genre</label>
        <select
          id="genre-select"
          className="genre-select"
          value={settings.genreId}
          onChange={(e) => onSettingsChange({ genreId: Number(e.target.value) })}
          disabled={isReady}
        >
          {genres.map((genre) => (
            <option key={genre.id} value={genre.id}>{genre.name}</option>
          ))}
        </select>

        <span className="settings-label">Guess the</span>
        <div className="mode-buttons">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              className={`mode-button ${settings.mode === mode.id ? 'active' : ''}`}
              onClick={() => onSettingsChange({ mode: mode.id })}
              disabled={isReady}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="lobby-container">
      <div className="lobby-box">
        <h2>Welcome to TuneDuel!</h2>
        <p className="description">Test your music knowledge in this exciting trivia game.</p>

        {!joined ? (
          <div className="join-section">
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
              className="username-input"
            />
            <button onClick={handleJoin} className="join-button">
              Join Game
            </button>
          </div>
        ) : (
          <div className="waiting-section">
            <p className="welcome-message">Welcome, {username}! 🎉</p>

            {renderSettings()}

            <div className="players-count">
              <p>Players joined: {players.length}</p>
              <ul className="players-list">
                {players.map((player) => (
                  <li key={player.clientId}>
                    {player.userId}
                    {player.clientId === hostClientId ? ' 👑' : ''}
                    {player.ready ? ' ✓' : ''}
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={handleStart} className="start-button" disabled={isReady}>
              {!isReady ? 'Ready to Play!' : allReady ? 'Loading songs…' : 'Waiting for other players…'}
            </button>
            <p className="game-info">
              10 songs • 30 seconds per song • Earn points for correct answers
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameLobby;
