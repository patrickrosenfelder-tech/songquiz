import React, { useEffect, useState } from 'react';
import './GameLobby.css';
import './RoundPick.css';

const MODES = [
  { id: 'artist', label: 'Artist' },
  { id: 'title', label: 'Title' },
  { id: 'mix', label: 'Mix' }
];

function RoundPick({ pick, roundPick, clientId, genres = [], onPick }) {
  const isPicker = pick.pickerClientId === clientId;
  const [genreId, setGenreId] = useState(pick.settings.genreId);
  const [mode, setMode] = useState(pick.settings.mode);
  const [secondsLeft, setSecondsLeft] = useState(pick.timeLimit);

  // New pick (next round, or the picker changed): reset the form and countdown
  useEffect(() => {
    setGenreId(pick.settings.genreId);
    setMode(pick.settings.mode);
  }, [pick]);

  useEffect(() => {
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil(pick.timeLimit - (Date.now() - pick.receivedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [pick]);

  const genreName = (id) => (genres.find((g) => g.id === id) || {}).name || '';
  const modeLabel = (id) => (MODES.find((m) => m.id === id) || {}).label || '';

  return (
    <div className="lobby-container">
      <div className="card lobby-box">
        <p className="pick-round-label">Round {pick.matchRound} of {pick.matchRounds}</p>

        {roundPick ? (
          <>
            <h2>{genreName(roundPick.genreId)} · {modeLabel(roundPick.mode)}</h2>
            <p className="description">
              {roundPick.pickerName ? `Picked by ${roundPick.pickerName}. ` : ''}Loading songs…
            </p>
          </>
        ) : isPicker ? (
          <>
            <h2>Your pick</h2>
            <p className="description">Choose the genre and what everyone guesses this round.</p>
            <div className="settings-section">
              <label className="settings-label" htmlFor="pick-genre">Genre</label>
              <select
                id="pick-genre"
                className="genre-select"
                value={genreId}
                onChange={(e) => setGenreId(Number(e.target.value))}
              >
                {genres.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <span className="settings-label">Guess the</span>
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
              <button className="btn-primary pick-start" onClick={() => onPick({ genreId, mode })}>
                Start round
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{pick.pickerName} is picking…</h2>
            <p className="description">They're choosing the genre and mode for this round.</p>
          </>
        )}

        {!roundPick && (
          <p className="pick-timer">
            {isPicker ? `Random pick in ${secondsLeft}s` : `${secondsLeft}s left to pick`}
          </p>
        )}

        {pick.matchRound > 1 && (
          <div className="standings">
            <p className="settings-label">Standings</p>
            <ol className="standings-list">
              {pick.standings.map((p, i) => (
                <li key={p.clientId} className={`standings-row ${p.clientId === clientId ? 'is-me' : ''}`}>
                  <span className="standings-rank">{i + 1}</span>
                  <span className="standings-name">{p.userId}</span>
                  <span className="standings-score">{p.score.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoundPick;
