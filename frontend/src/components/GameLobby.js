import React, { useState } from 'react';
import './GameLobby.css';

function GameLobby({ onJoin, onStart, players = [] }) {
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoin = () => {
    if (username.trim()) {
      onJoin(username);
      setJoined(true);
    }
  };

  const handleStart = () => {
    onStart();
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
            <div className="players-count">
              <p>Players joined: {Array.isArray(players) ? players.length : players}</p>
            </div>
            <button onClick={handleStart} className="start-button">
              Ready to Play!
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
