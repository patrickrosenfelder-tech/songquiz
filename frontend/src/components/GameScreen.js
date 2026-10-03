import React, { useState, useEffect, useRef } from 'react';
import './GameScreen.css';

function GameScreen({ song, round, totalRounds, matchRound, matchRounds, score, answerResult, roundResult, onAnswerSubmit }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [nextIn, setNextIn] = useState(null);
  // Browsers can block autoplay; then the player gets a one-time "tap to play" button
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef(null);
  // Latest handleSubmit, so the countdown effect doesn't restart on every render
  const handleSubmitRef = useRef();
  const roundOver = !!roundResult;

  useEffect(() => {
    if (roundOver) return;
    if (timeLeft <= 0) {
      handleSubmitRef.current();
      return;
    }

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, roundOver]);

  useEffect(() => {
    setTimeLeft(song.duration || 30);
    setSelectedAnswer(null);
    setSubmitted(false);
  }, [song]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioBlocked(false);
    audio.play().catch((err) => {
      // AbortError just means a newer play/pause interrupted this one
      if (err.name === 'NotAllowedError') setAudioBlocked(true);
    });
    return () => audio.pause();
  }, [song.audioUrl]);

  const startBlockedAudio = () => {
    audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => {});
  };

  // Countdown to the next song once the server reveals the answer
  useEffect(() => {
    setNextIn(roundResult ? roundResult.nextIn : null);
  }, [roundResult]);

  useEffect(() => {
    if (!nextIn) return;
    const timer = setTimeout(() => setNextIn(nextIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [nextIn]);

  // Tapping an option answers immediately; the timeout submits 'skipped'
  const handleSubmit = (answer) => {
    if (!submitted && !roundOver) {
      setSelectedAnswer(answer || null);
      onAnswerSubmit(answer || 'skipped');
      setSubmitted(true);
    }
  };
  handleSubmitRef.current = handleSubmit;

  const getOptionClass = (option) => {
    const classes = ['option-button'];
    if (roundOver) {
      if (option === roundResult.correctAnswer) classes.push('correct');
      else if (option === selectedAnswer) classes.push('wrong');
    } else if (option === selectedAnswer) {
      classes.push('selected');
    }
    if (submitted || roundOver) classes.push('disabled');
    return classes.join(' ');
  };

  const renderRoundResult = () => {
    let headline;
    if (answerResult && answerResult.correct) {
      headline = `Correct! +${answerResult.points} pts`;
    } else if (!selectedAnswer) {
      headline = "Time's up";
    } else {
      headline = 'Not this time';
    }

    return (
      <div className={`round-result ${answerResult && answerResult.correct ? 'is-correct' : 'is-wrong'}`}>
        <p className="round-result-headline">{headline}</p>
        <p className="round-result-song">
          <strong>{roundResult.title}</strong> by {roundResult.artist}
        </p>
        <p className="next-in">
          {roundResult.isLastRound
            ? (roundResult.isLastMatchRound ? 'Final results' : 'Next round')
            : 'Next track'} in {nextIn ?? 0}s
        </p>
      </div>
    );
  };

  const duration = song.duration || 30;
  const timeFraction = Math.max(0, Math.min(1, timeLeft / duration));
  const spinning = !!song.audioUrl && !audioBlocked && !roundOver;

  return (
    <div className="game-screen">
      <div className="card game-card">
        <div className="game-header">
          <span>
            {matchRounds > 1 && <>Round {matchRound}/{matchRounds} · </>}
            Track {round} of {totalRounds}
          </span>
          <span className="game-score">{score.toLocaleString()} pts</span>
        </div>

        <div className="turntable">
          {song.audioUrl && (
            // No controls: players can't pause or skip ahead
            <audio
              ref={audioRef}
              key={song.audioUrl}
              src={song.audioUrl}
              preload="auto"
              onPlaying={() => setAudioBlocked(false)}
            />
          )}
          <div className={`vinyl ${spinning ? 'spinning' : ''}`} aria-hidden="true">
            <div className="vinyl-label">
              <span className="vinyl-hole" />
            </div>
          </div>
          {audioBlocked && (
            <button className="play-audio-button" onClick={startBlockedAudio}>▶ Start the song</button>
          )}
        </div>

        <div className={`time-bar ${timeLeft <= 5 && !roundOver ? 'urgent' : ''}`}>
          <div className="time-bar-track">
            <div className="time-bar-fill" style={{ width: `${timeFraction * 100}%` }} />
          </div>
          <span className="time-left">{timeLeft}s</span>
        </div>

        <h3 className="question">
          {song.questionType === 'title' ? "What's the title?" : "Who's the artist?"}
        </h3>

        <div className="options-section">
          {song.options && song.options.map((option, index) => (
            <button
              key={index}
              className={getOptionClass(option)}
              onClick={() => handleSubmit(option)}
              disabled={submitted || roundOver}
            >
              {option}
            </button>
          ))}
        </div>

        {roundOver ? (
          renderRoundResult()
        ) : submitted ? (
          <p className="status-message">Locked in. Waiting for the others…</p>
        ) : (
          <p className="status-message hint">Tap an answer to lock it in</p>
        )}
      </div>
    </div>
  );
}

export default GameScreen;
