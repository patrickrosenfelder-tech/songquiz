import Head from 'next/head';
import { useGameSession } from '../hooks/useGameSession';
import AudioPlayer from '../components/AudioPlayer';
import GuessForm from '../components/GuessForm';
import RoundResult from '../components/RoundResult';
import ScoreBoard from '../components/ScoreBoard';

export default function Home() {
  const { state, startGame, submitGuess, nextRound, reset } = useGameSession();
  const { phase, roundView, summary, error } = state;

  return (
    <>
      <Head>
        <title>TuneDuel — Music Quiz</title>
        <meta name="description" content="10-round song recognition game" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        <header className="game-header">
          <h1 className="logo">🎵 TuneDuel</h1>
          {roundView && (
            <div className="round-counter">
              Round {roundView.roundNumber} / {roundView.totalRounds}
              <span className="header-score"> · {roundView.totalScore} pts</span>
            </div>
          )}
        </header>

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <section className="splash">
            <p className="tagline">Hear a clip. Name the song. Beat the clock.</p>
            <p className="detail">
              10 rounds · 100 pts per correct answer · Speed bonus up to +50
            </p>
            <button className="start-btn" onClick={() => startGame()}>
              Start Game
            </button>
          </section>
        )}

        {/* ── LOADING ── */}
        {phase === 'loading' && (
          <div className="loading">Loading…</div>
        )}

        {/* ── IN ROUND ── */}
        {(phase === 'in_round' || phase === 'submitting') && roundView && (
          <section className="round-section">
            <AudioPlayer
              src={roundView.clipUrl}
              disabled={phase === 'submitting'}
            />
            <GuessForm
              onSubmit={submitGuess}
              disabled={phase === 'submitting'}
            />
            {phase === 'submitting' && (
              <p className="submitting-msg">Checking…</p>
            )}
          </section>
        )}

        {/* ── ROUND OVER ── */}
        {phase === 'round_over' && roundView && (
          <section className="round-section">
            <RoundResult
              roundView={roundView}
              onNext={nextRound}
            />
          </section>
        )}

        {/* ── FINISHED ── */}
        {phase === 'finished' && summary && (
          <section className="scoreboard-section">
            <ScoreBoard summary={summary} onPlayAgain={reset} />
          </section>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <section className="error-section">
            <p className="error-msg">Something went wrong: {error}</p>
            <button onClick={reset}>Try Again</button>
          </section>
        )}
      </main>
    </>
  );
}
