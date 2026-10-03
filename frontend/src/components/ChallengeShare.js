import React, { useEffect, useState } from 'react';
import { api } from '../api';
import './Social.css';

// After a solo game: share a link, or send the challenge to friends or any player by name
function ChallengeShare({ gameId, shareOrigin }) {
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [sentTo, setSentTo] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/friends').then(({ friends }) => setFriends(friends)).catch(() => {});
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api(`/users/search?q=${encodeURIComponent(query.trim())}`)
        .then(({ users }) => setResults(users))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const createLink = async () => {
    try {
      setError(null);
      const { code } = await api('/challenges', { method: 'POST', body: { gameId } });
      const url = `${shareOrigin || window.location.origin}/?challenge=${code}`;
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // Clipboard needs https or localhost; the link stays visible to copy by hand
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const sendTo = async (player) => {
    try {
      setError(null);
      await api('/challenges', { method: 'POST', body: { gameId, userIds: [player.id] } });
      setSentTo((prev) => [...prev, player.id]);
    } catch (err) {
      setError(err.message);
    }
  };

  const renderPlayer = (player) => (
    <li key={player.id} className="social-row">
      <span className="social-name">{player.displayName}</span>
      {sentTo.includes(player.id) ? (
        <span className="social-done">Sent ✓</span>
      ) : (
        <button className="copy-button" onClick={() => sendTo(player)}>Challenge</button>
      )}
    </li>
  );

  return (
    <div className="challenge-share">
      <p className="settings-label">Challenge others to beat your score</p>

      {link ? (
        <div className="invite-link-row">
          <input className="invite-link" value={link} readOnly onFocus={(e) => e.target.select()} />
          <button className="copy-button" onClick={createLink}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={createLink}>Copy challenge link</button>
      )}

      {friends.length > 0 && (
        <>
          <p className="social-subhead">Your friends</p>
          <ul className="social-list">{friends.map(renderPlayer)}</ul>
        </>
      )}

      <p className="social-subhead">Any player</p>
      <input
        className="username-input"
        placeholder="Search by name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && <ul className="social-list">{results.map(renderPlayer)}</ul>}
      {error && <p className="join-error">{error}</p>}
    </div>
  );
}

export default ChallengeShare;
