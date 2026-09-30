/**
 * RoundResult — shows correct/incorrect feedback and triggers next-round
 */

import type { RoundView } from '../lib/types';

interface Props {
  roundView: RoundView;
  onNext: () => void;
  loading?: boolean;
}

export default function RoundResult({ roundView, onNext, loading }: Props) {
  const { result } = roundView;
  if (!result) return null;

  return (
    <div className={`round-result ${result.correct ? 'correct' : 'incorrect'}`}>
      <div className="result-icon">{result.correct ? '🎵' : '❌'}</div>

      {result.albumArtUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.albumArtUrl}
          alt={`${result.correctAnswer} album art`}
          className="album-art"
        />
      )}

      <div className="result-text">
        <p className="result-verdict">
          {result.correct ? 'Correct!' : 'Not quite…'}
        </p>
        <p className="result-song">
          <strong>{result.correctAnswer}</strong>
          <span className="result-artist"> — {result.artistName}</span>
        </p>
        {result.correct && (
          <p className="result-points">+{result.points} pts</p>
        )}
      </div>

      <p className="score-running">
        Total: <strong>{roundView.totalScore}</strong> pts
      </p>

      <button className="next-btn" onClick={onNext} disabled={loading}>
        {loading ? '…' : roundView.roundNumber === roundView.totalRounds ? 'See Results' : 'Next Round →'}
      </button>
    </div>
  );
}
