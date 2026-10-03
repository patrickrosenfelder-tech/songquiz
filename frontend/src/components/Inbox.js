import React, { useEffect, useState } from 'react';
import { api } from '../api';
import './GameLobby.css';
import './Leaderboard.css';
import './Social.css';

const MODE_LABELS = { artist: 'Artist', title: 'Title', mix: 'Mix' };

function Inbox({ genres = [], onPlayChallenge, onShowFriends, onBack, onSeen }) {
  const [inbox, setInbox] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/inbox')
      .then((data) => {
        setInbox(data);
        // Opening the inbox counts as seeing new results
        if (data.results.some((r) => r.unseen)) api('/inbox/seen', { method: 'POST' }).then(onSeen).catch(() => {});
      })
      .catch((err) => setError(err.message));
  }, [onSeen]);

  const genreName = (id) => (genres.find((g) => g.id === id) || {}).name || '';
  const daysLeft = (date) => Math.max(0, Math.ceil((new Date(date) - Date.now()) / 86400000));

  return (
    <div className="lobby-container">
      <div className="card lobby-box">
        <button className="link-button back-button" onClick={onBack}>← Back</button>
        <h2>Inbox</h2>
        {error && <p className="join-error">{error}</p>}
        {!inbox && !error && <p className="board-empty">Loading…</p>}

        {inbox && (
          <>
            {inbox.friendRequests > 0 && (
              <button className="settings-summary inbox-banner" onClick={onShowFriends}>
                {inbox.friendRequests} friend request{inbox.friendRequests === 1 ? '' : 's'} waiting →
              </button>
            )}

            <p className="settings-label">Challenges for you</p>
            {inbox.challenges.length === 0 ? (
              <p className="board-empty">No open challenges. Ask a friend to send you one.</p>
            ) : (
              <ul className="social-list">
                {inbox.challenges.map((c) => (
                  <li key={c.code} className="social-row">
                    <span className="social-name">
                      <span><strong>{c.challengerName}</strong> · {c.challengerScore.toLocaleString()} pts</span>
                      <span className="social-meta">{genreName(c.genreId)} · {MODE_LABELS[c.questionMode]} · {daysLeft(c.expiresAt)}d left</span>
                    </span>
                    <button className="copy-button" onClick={() => onPlayChallenge(c.code)}>Play</button>
                  </li>
                ))}
              </ul>
            )}

            <p className="settings-label inbox-section">Results of your challenges</p>
            {inbox.results.length === 0 ? (
              <p className="board-empty">Nobody has taken your challenges yet.</p>
            ) : (
              <ul className="social-list">
                {inbox.results.map((r, i) => {
                  const outcome = r.score > r.yourScore ? 'beat you' : r.score < r.yourScore ? 'lost' : 'tied';
                  return (
                    <li key={`${r.code}-${i}`} className={`social-row ${r.unseen ? 'is-new' : ''}`}>
                      <span className="social-name">
                        <span><strong>{r.name}</strong>{r.isGuest && <span className="guest-tag">guest</span>} {outcome}</span>
                        <span className="social-meta">{r.score.toLocaleString()} vs your {r.yourScore.toLocaleString()} · {genreName(r.genreId)}</span>
                      </span>
                      <span className={`outcome-badge ${outcome === 'beat you' ? 'is-loss' : outcome === 'lost' ? 'is-win' : ''}`}>
                        {outcome === 'beat you' ? 'L' : outcome === 'lost' ? 'W' : 'T'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Inbox;
