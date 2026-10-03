import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import './GameLobby.css';
import './Leaderboard.css';
import './Social.css';

function Friends({ onBack, onChange }) {
  const [lists, setLists] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    api('/friends').then(setLists).catch((err) => setError(err.message));
    onChange?.();
  }, [onChange]);

  useEffect(() => { refresh(); }, [refresh]);

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

  const act = async (fn) => {
    try {
      setError(null);
      await fn();
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const relation = (id) => {
    if (lists?.friends.some((u) => u.id === id)) return 'friend';
    if (lists?.outgoing.some((u) => u.id === id)) return 'requested';
    if (lists?.incoming.some((u) => u.id === id)) return 'incoming';
    return null;
  };

  return (
    <div className="lobby-container">
      <div className="card lobby-box">
        <button className="link-button back-button" onClick={onBack}>← Back</button>
        <h2>Friends</h2>
        <p className="description">Add friends to challenge them with one tap.</p>

        <input
          className="username-input"
          placeholder="Find players by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="social-list">
            {results.map((u) => (
              <li key={u.id} className="social-row">
                <span className="social-name">{u.displayName}</span>
                {relation(u.id) === 'friend' && <span className="social-done">Friends</span>}
                {relation(u.id) === 'requested' && <span className="social-done">Requested</span>}
                {relation(u.id) === 'incoming' && (
                  <button className="copy-button" onClick={() => act(() => api(`/friends/${u.id}/accept`, { method: 'POST' }))}>Accept</button>
                )}
                {relation(u.id) === null && (
                  <button className="copy-button" onClick={() => act(() => api('/friends', { method: 'POST', body: { userId: u.id } }))}>Add</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="join-error">{error}</p>}

        {lists && lists.incoming.length > 0 && (
          <>
            <p className="settings-label inbox-section">Requests</p>
            <ul className="social-list">
              {lists.incoming.map((u) => (
                <li key={u.id} className="social-row">
                  <span className="social-name">{u.displayName}</span>
                  <span className="social-actions">
                    <button className="copy-button" onClick={() => act(() => api(`/friends/${u.id}/accept`, { method: 'POST' }))}>Accept</button>
                    <button className="link-button" onClick={() => act(() => api(`/friends/${u.id}`, { method: 'DELETE' }))}>Decline</button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="settings-label inbox-section">Your friends</p>
        {lists && lists.friends.length === 0 && <p className="board-empty">No friends yet. Search above to add some.</p>}
        {lists && lists.friends.length > 0 && (
          <ul className="social-list">
            {lists.friends.map((u) => (
              <li key={u.id} className="social-row">
                <span className="social-name">{u.displayName}</span>
                <button className="link-button" onClick={() => act(() => api(`/friends/${u.id}`, { method: 'DELETE' }))}>Remove</button>
              </li>
            ))}
          </ul>
        )}

        {lists && lists.outgoing.length > 0 && (
          <>
            <p className="settings-label inbox-section">Sent requests</p>
            <ul className="social-list">
              {lists.outgoing.map((u) => (
                <li key={u.id} className="social-row">
                  <span className="social-name">{u.displayName}</span>
                  <button className="link-button" onClick={() => act(() => api(`/friends/${u.id}`, { method: 'DELETE' }))}>Cancel</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export default Friends;
