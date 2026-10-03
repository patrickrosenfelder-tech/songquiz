import React, { useEffect, useState } from 'react';
import { api } from '../api';
import './GameLobby.css';
import './Leaderboard.css';

const MODES = [
  { id: 'artist', label: 'Artist' },
  { id: 'title', label: 'Title' },
  { id: 'mix', label: 'Mix' }
];

function Leaderboard({ onBack, initialMode = 'artist', initialGenre = '' }) {
  const [mode, setMode] = useState(initialMode);
  const [genre, setGenre] = useState(initialGenre);
  const [genres, setGenres] = useState([]);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/genres').then(({ genres }) => setGenres(genres)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setError(null);
    const query = new URLSearchParams({ mode, ...(genre !== '' ? { genre } : {}) });
    api(`/leaderboard?${query}`)
      .then((data) => { if (!cancelled) setBoard(data); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [mode, genre]);

  const genreName = (id) => (genres.find((g) => g.id === id) || {}).name || '';
  const showMeBelow = board?.me && !board.entries.some((e) => e.isMe);

  const renderRow = (entry) => (
    <li key={`${entry.rank}-${entry.displayName}`} className={`board-row ${entry.isMe ? 'is-me' : ''} ${entry.rank <= 3 ? `top-${entry.rank}` : ''}`}>
      <span className="board-rank">{entry.rank}</span>
      <span className="board-name">
        {entry.displayName}
        {genre === '' && <span className="board-genre">{genreName(entry.genreId)}</span>}
      </span>
      <span className="board-score">{entry.score.toLocaleString()}</span>
    </li>
  );

  return (
    <div className="lobby-container">
      <div className="card lobby-box">
        <button className="link-button back-button" onClick={onBack}>← Back</button>
        <h2>Leaderboards</h2>
        <p className="description">Best single solo game per player. Ties go to whoever got there first.</p>

        <div className="settings-section">
          <div className="mode-buttons">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`mode-button ${mode === m.id ? 'active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <select
            className="genre-select"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            aria-label="Genre"
          >
            <option value="">Overall (all genres)</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className="board">
          {error && <p className="join-error">{error}</p>}
          {!board && !error && <p className="board-empty">Loading…</p>}
          {board && board.entries.length === 0 && (
            <p className="board-empty">No scores yet. Play a solo game to claim the top spot.</p>
          )}
          {board && board.entries.length > 0 && (
            <ol className="board-list">
              {board.entries.map(renderRow)}
            </ol>
          )}
          {showMeBelow && (
            <>
              <p className="board-you">Your best</p>
              <ol className="board-list">{renderRow(board.me)}</ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;
