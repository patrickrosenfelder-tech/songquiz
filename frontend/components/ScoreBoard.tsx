/**
 * ScoreBoard — end-of-game summary table
 */

import type { SessionSummary } from '../lib/types';

interface Props {
  summary: SessionSummary;
  onPlayAgain: () => void;
}

export default function ScoreBoard({ summary, onPlayAgain }: Props) {
  const pct = Math.round((summary.totalScore / summary.maxScore) * 100);

  return (
    <div className="scoreboard">
      <h2>Game Over!</h2>
      <div className="final-score">
        <span className="score-big">{summary.totalScore}</span>
        <span className="score-max"> / {summary.maxScore}</span>
      </div>
      <p className="score-pct">{pct}% accuracy</p>

      <table className="rounds-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Song</th>
            <th>Artist</th>
            <th>Your Guess</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {summary.rounds.map((r) => (
            <tr key={r.roundNumber} className={r.correct ? 'row-correct' : 'row-wrong'}>
              <td>{r.roundNumber}</td>
              <td>{r.songTitle}</td>
              <td>{r.artistName}</td>
              <td className="guess-col">{r.guess ?? <em>no answer</em>}</td>
              <td>{r.points > 0 ? `+${r.points}` : '0'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="play-again-btn" onClick={onPlayAgain}>
        Play Again
      </button>
    </div>
  );
}
