import React from 'react';
import './GameOver.css';

function GameOver({ finalScore, results, onRestart }) {
  return (
    <div className="gameover-container">
      <div className="gameover-box">
        <h2>Game Over!</h2>
        <div className="final-score">
          <span className="score-label">Final Score</span>
          <span className="score-value">{finalScore}</span>
        </div>

        {results && (
          <div className="results-section">
            <h3>Results Summary</h3>
            <div className="results-grid">
              {results.map((result, index) => (
                <div key={index} className="result-item">
                  <span className="result-rank">#{index + 1}</span>
                  <span className="result-name">{result.player}</span>
                  <span className="result-score">{result.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onRestart} className="play-again-button">
          Play Again
        </button>

        <div className="game-stats">
          <p>Thanks for playing TuneDuel! 🎵</p>
        </div>
      </div>
    </div>
  );
}

export default GameOver;
