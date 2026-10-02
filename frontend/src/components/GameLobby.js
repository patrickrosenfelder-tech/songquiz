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
  joinError,
  gameId,
  players = [],
  clientId,
  hostClientId,
  settings,
  genres = []
}) {
  const [username, setUsername] = useState('');
  // Invite links look like ?game=K7PXM
  const [gameCode, setGameCode] = useState(
    () => new URLSearchParams(window.location.search).get('game') || ''
  );
  const [copied, setCopied] = useState(false);
  const joined = !!gameId;
  const inviteLink = gameId ? `${window.location.origin}/?game=${gameId}` : '';

  const isHost = !!clientId && clientId === hostClientId;
  const me = players.find((p) => p.clientId === clientId);
  const isReady = !!me && me.ready;
  const allReady = players.length > 0 && players.every((p) => p.ready);
  const genreName = (genres.find((g) => g.id === settings?.genreId) || {}).name || 'All';
  const modeLabel = (MODES.find((m) => m.id === settings?.mode) || MODES[0]).label;

  const handleJoin = () => {
    if (username.trim()) {
      onJoin(username.trim(), gameCode.trim().toUpperCase());
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard needs https or localhost; the link stays visible to copy by hand
      setCopied(false);
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
      <div className="card lobby-box">
        <h2>{joined ? 'The lounge' : 'Drop the needle'}</h2>
        <p className="description">{joined ? 'Pick your sound, invite friends, and get ready.' : 'Guess songs from 30-second clips. Fastest right answer wins.'}</p>

        {!joined ? (
          <div className="join-section">
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
              className="username-input"
              maxLength={20}
            />
            <input
              type="text"
              placeholder="Game code (leave empty to create a new game)"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
              className="username-input game-code-input"
              maxLength={5}
            />
            <button onClick={handleJoin} className="btn-primary join-button" disabled={!username.trim()}>
              {gameCode.trim() ? 'Join game' : 'Create game'}
            </button>
            {joinError && <p className="join-error">{joinError}</p>}
          </div>
        ) : (
          <div className="waiting-section">
            <p className="welcome-message">Hi {username}, you're in.</p>

            <div className="invite-section">
              <p className="invite-code">Game code: <strong>{gameId}</strong></p>
              <p className="invite-hint">Friends can enter this code, or open the link:</p>
              <div className="invite-link-row">
                <input className="invite-link" value={inviteLink} readOnly onFocus={(e) => e.target.select()} />
                <button className="copy-button" onClick={copyInvite}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>

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
            <button onClick={handleStart} className="btn-primary start-button" disabled={isReady}>
              {!isReady ? "I'm ready" : allReady ? 'Loading songs…' : 'Waiting for other players…'}
            </button>
            <p className="game-info">
              10 tracks · 30 seconds each · faster answers score more
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameLobby;
