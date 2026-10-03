import React, { useState } from 'react';
import './GameLobby.css';
import './Auth.css';

const MODES = [
  { id: 'artist', label: 'Artist' },
  { id: 'title', label: 'Title' },
  { id: 'mix', label: 'Mix' }
];

function GameLobby({
  user,
  gameKind,
  onShowLeaderboard,
  shareOrigin,
  signIn,
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
  const isSolo = gameKind === 'solo';
  const inviteLink = gameId ? `${shareOrigin || window.location.origin}/?game=${gameId}` : '';

  const isHost = !!clientId && clientId === hostClientId;
  const me = players.find((p) => p.clientId === clientId);
  const isReady = !!me && me.ready;
  const allReady = players.length > 0 && players.every((p) => p.ready);
  const genreName = (genres.find((g) => g.id === settings?.genreId) || {}).name || 'All';
  const modeLabel = (MODES.find((m) => m.id === settings?.mode) || MODES[0]).label;

  const signedIn = !!user;
  const code = gameCode.trim().toUpperCase();
  const myName = signedIn ? user.displayName : username.trim();

  // Signed-in players create or join with their account name; guests need a name and a code
  const handleJoin = () => {
    if (signedIn) {
      onJoin(null, code);
    } else if (username.trim() && code) {
      onJoin(username.trim(), code);
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

  // Multiplayer: host sets the number of rounds; players pick genre and mode per round
  const renderMatchSettings = () => {
    const roundCount = settings.roundCount || 3;
    const summary = `${roundCount} round${roundCount === 1 ? '' : 's'} · 7 songs each`;
    return (
      <div className="settings-section">
        {isHost ? (
          <>
            <span className="settings-label">Rounds</span>
            <div className="round-buttons">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`mode-button ${roundCount === n ? 'active' : ''}`}
                  onClick={() => onSettingsChange({ roundCount: n })}
                  disabled={isReady}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="settings-hint">{summary}. Players take turns picking the genre and mode.</p>
          </>
        ) : (
          <>
            <p className="settings-summary"><strong>{summary}</strong></p>
            <p className="settings-hint">Players take turns picking the genre and mode. The host sets the number of rounds.</p>
          </>
        )}
      </div>
    );
  };

  const renderSettings = () => {
    if (!settings) return null;
    if (!isSolo) return renderMatchSettings();

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
        <h2>{!joined ? 'Drop the needle' : isSolo ? 'Solo run' : 'The lounge'}</h2>
        <p className="description">
          {!joined
            ? 'Guess songs from 30-second clips. Fastest right answer wins.'
            : isSolo
              ? 'Pick a genre and mode. Your best game counts for the leaderboards.'
              : 'Pick your sound, invite friends, and get ready.'}
        </p>

        {!joined ? (
          signedIn ? (
            <div className="join-section">
              <button onClick={() => onJoin(null, '', { solo: true })} className="btn-primary join-button">
                Play solo
              </button>
              <button onClick={() => onJoin(null, '')} className="btn-secondary">
                Play with friends
              </button>
              <div className="divider">or join a friend</div>
              <div className="invite-link-row">
                <input
                  type="text"
                  placeholder="Game code"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && code && handleJoin()}
                  className="username-input game-code-input"
                  maxLength={5}
                />
                <button onClick={handleJoin} className="copy-button" disabled={!code}>Join</button>
              </div>
              {joinError && <p className="join-error">{joinError}</p>}
              <button className="link-button" onClick={onShowLeaderboard}>View leaderboards</button>
            </div>
          ) : (
            <div className="join-section">
              <p className="settings-hint">Sign in to create games and save your scores.</p>
              {signIn}
              <div className="divider">got a game code? join as a guest</div>
              <input
                type="text"
                placeholder="Your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                className="username-input"
                maxLength={20}
              />
              <input
                type="text"
                placeholder="Game code"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                className="username-input game-code-input"
                maxLength={5}
              />
              <button onClick={handleJoin} className="btn-primary join-button" disabled={!username.trim() || !code}>
                Join as guest
              </button>
              <p className="settings-hint">Guests can play with friends, but scores aren't saved to leaderboards.</p>
              {joinError && <p className="join-error">{joinError}</p>}
              <button className="link-button" onClick={onShowLeaderboard}>View leaderboards</button>
            </div>
          )
        ) : (
          <div className="waiting-section">
            {!isSolo && <p className="welcome-message">Hi {myName}, you're in.</p>}

            {!isSolo && <div className="invite-section">
              <p className="invite-code">Game code: <strong>{gameId}</strong></p>
              <p className="invite-hint">Friends can enter this code, or open the link:</p>
              <div className="invite-link-row">
                <input className="invite-link" value={inviteLink} readOnly onFocus={(e) => e.target.select()} />
                <button className="copy-button" onClick={copyInvite}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>}

            {renderSettings()}

            {!isSolo && <div className="players-count">
              <p>Players joined: {players.length}</p>
              <ul className="players-list">
                {players.map((player) => (
                  <li key={player.clientId}>
                    {player.userId}
                    {player.isGuest && <span className="guest-tag">guest</span>}
                    {player.clientId === hostClientId ? ' 👑' : ''}
                    {player.ready ? ' ✓' : ''}
                  </li>
                ))}
              </ul>
            </div>}
            <button onClick={handleStart} className="btn-primary start-button" disabled={isReady}>
              {isSolo
                ? (isReady ? 'Loading songs…' : 'Start')
                : !isReady ? "I'm ready" : allReady ? 'Loading songs…' : 'Waiting for other players…'}
            </button>
            <p className="game-info">
              7 tracks · 30 seconds each · faster answers score more
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameLobby;
