import React from 'react';
import './GameOver.css';
import ChallengeShare from './ChallengeShare';

const MODE_LABELS = { artist: 'Artist', title: 'Title', mix: 'Mix' };

const CHALLENGE_HEADLINES = { win: 'You win!', lose: 'So close', tie: "It's a tie" };

function GameOver({ finalScore, results, soloSummary, challengeSummary, canChallenge, shareOrigin, matchRounds, genres = [], isGuest, onRestart }) {
  const genreName = soloSummary ? ((genres.find((g) => g.id === soloSummary.genreId) || {}).name || '') : '';
  const modeLabel = soloSummary ? MODE_LABELS[soloSummary.questionMode] : '';

  return (
    <div className="gameover-container">
      <div className="card gameover-box">
        <h2>
          {challengeSummary
            ? CHALLENGE_HEADLINES[challengeSummary.outcome]
            : soloSummary
            ? (soloSummary.personalBest ? 'New personal best!' : "That's a wrap")
            : results && results.length > 1 ? `${results[0].player} wins!` : "That's a wrap"}
        </h2>
        {/* Challenges compare both scores side by side instead */}
        {!challengeSummary && <div className="final-score">
          <span className="score-label">{matchRounds > 1 ? `Your total · ${matchRounds} rounds` : 'Your score'}</span>
          <span className="score-value">{finalScore.toLocaleString()}</span>
          {soloSummary && soloSummary.previousBest !== null && !soloSummary.personalBest && (
            <span className="score-sub">Your best: {soloSummary.previousBest.toLocaleString()}</span>
          )}
        </div>}

        {soloSummary && (
          <div className="solo-ranks">
            <div className="solo-rank">
              <span className="solo-rank-value">#{soloSummary.genreRank ?? '–'}</span>
              <span className="solo-rank-label">{genreName} · {modeLabel}</span>
            </div>
            <div className="solo-rank">
              <span className="solo-rank-value">#{soloSummary.overallRank ?? '–'}</span>
              <span className="solo-rank-label">Overall · {modeLabel}</span>
            </div>
          </div>
        )}

        {challengeSummary && (
          <div className="solo-ranks">
            <div className="solo-rank">
              <span className="solo-rank-value">{challengeSummary.yourScore.toLocaleString()}</span>
              <span className="solo-rank-label">You</span>
            </div>
            <div className="solo-rank">
              <span className="solo-rank-value">{challengeSummary.challengerScore.toLocaleString()}</span>
              <span className="solo-rank-label">{challengeSummary.challengerName}</span>
            </div>
          </div>
        )}

        {soloSummary?.gameId && canChallenge && <ChallengeShare gameId={soloSummary.gameId} shareOrigin={shareOrigin} />}

        {results && !soloSummary && !challengeSummary && (
          <div className="results-section">
            <h3>Final ranking</h3>
            <div className="results-grid">
              {results.map((result, index) => (
                <div key={index} className={`result-item ${index === 0 ? 'is-winner' : ''}`}>
                  <span className="result-rank">#{index + 1}</span>
                  <span className="result-name">{result.player}</span>
                  <span className="result-score">{result.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isGuest && (
          <p className="guest-note">Playing as a guest. Sign in next time to save your scores and climb the leaderboards.</p>
        )}

        <button onClick={onRestart} className="btn-primary play-again-button">
          Play again
        </button>

        <div className="game-stats">
          <p>Thanks for playing TuneDuel</p>
        </div>
      </div>
    </div>
  );
}

export default GameOver;
