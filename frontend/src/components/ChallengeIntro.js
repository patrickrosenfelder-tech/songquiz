import React, { useEffect, useState } from 'react';
import { api } from '../api';
import './GameLobby.css';
import './Social.css';

const MODE_LABELS = { artist: 'Artist', title: 'Title', mix: 'Mix' };

function ChallengeIntro({ code, user, genres = [], joinError, onStart, onBack }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    api(`/challenges/${encodeURIComponent(code)}`).then(setInfo).catch((err) => setError(err.message));
  }, [code]);

  const genreName = info ? ((genres.find((g) => g.id === info.genreId) || {}).name || 'Music') : '';

  let blocker = null;
  if (info?.expired) blocker = 'This challenge has expired.';
  else if (info?.isOwn) blocker = "This is your own challenge. Share the link with friends.";
  else if (info?.forSomeoneElse) blocker = user ? 'This challenge was sent to someone else.' : 'This challenge was sent to a specific player. Sign in as them to take it.';
  else if (info && info.yourScore !== null) blocker = `You already took this challenge and scored ${info.yourScore.toLocaleString()}.`;

  const canStart = info && !blocker && (user || name.trim());

  return (
    <div className="lobby-container">
      <div className="card lobby-box">
        <button className="link-button back-button" onClick={onBack}>← Home</button>
        {error && <p className="join-error">{error}</p>}
        {!info && !error && <p className="description">Loading challenge…</p>}
        {info && (
          <>
            <p className="pick-round-label">Challenge</p>
            <h2>{info.challengerName} challenges you</h2>
            <p className="description">
              Same 7 songs, same questions. Beat their score to win.
            </p>
            <div className="challenge-target">
              <span className="challenge-target-label">Score to beat</span>
              <span className="challenge-target-score">{info.challengerScore.toLocaleString()}</span>
              <span className="challenge-target-meta">{genreName} · {MODE_LABELS[info.questionMode]}</span>
            </div>

            {blocker ? (
              <p className="settings-summary">{blocker}</p>
            ) : (
              <div className="join-section">
                {!user && (
                  <>
                    <input
                      className="username-input"
                      placeholder="Your name"
                      value={name}
                      maxLength={20}
                      onChange={(e) => setName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && canStart && onStart(code, name.trim())}
                    />
                    <p className="settings-hint">Playing as a guest. Sign in to keep track of your challenges.</p>
                  </>
                )}
                <button className="btn-primary" disabled={!canStart} onClick={() => onStart(code, name.trim())}>
                  Accept challenge
                </button>
                {joinError && <p className="join-error">{joinError}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ChallengeIntro;
