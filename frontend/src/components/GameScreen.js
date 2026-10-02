import React, { useState, useEffect, useRef } from 'react';
import './GameScreen.css';

function GameScreen({ song, round, totalRounds, score, answerResult, roundResult, onAnswerSubmit }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [nextIn, setNextIn] = useState(null);
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

  // Countdown to the next song once the server reveals the answer
  useEffect(() => {
    setNextIn(roundResult ? roundResult.nextIn : null);
  }, [roundResult]);

  useEffect(() => {
    if (!nextIn) return;
    const timer = setTimeout(() => setNextIn(nextIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [nextIn]);

  const handleSubmit = () => {
    if (!submitted) {
      onAnswerSubmit(selectedAnswer || 'skipped');
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
      headline = `✅ Correct! +${answerResult.points} points`;
    } else if (!selectedAnswer) {
      headline = "⏰ Time's up!";
    } else {
      headline = '❌ Wrong answer';
    }

    return (
      <div className={`round-result ${answerResult && answerResult.correct ? 'is-correct' : 'is-wrong'}`}>
        <p className="round-result-headline">{headline}</p>
        <p>It was <strong>{roundResult.correctAnswer}</strong> – {roundResult.title}</p>
        <p className="next-in">
          {roundResult.isLastRound ? 'Final results' : 'Next song'} in {nextIn ?? 0}s…
        </p>
      </div>
    );
  };

  const getTimerColor = () => {
    if (timeLeft > 15) return '#4CAF50';
    if (timeLeft > 5) return '#FFC107';
    return '#F44336';
  };

  return (
    <div className="game-screen">
      <div className="game-header">
        <div className="round-info">
          <span>Round {round} of {totalRounds}</span>
        </div>
        <div className="score">
          <span>Score: {score}</span>
        </div>
      </div>

      <div className="game-content">
        <div className="question-section">
          <h3>Who is the artist of this song?</h3>

          {song.audioUrl && (
            <div className="audio-player">
              <audio key={song.audioUrl} src={song.audioUrl} controls autoPlay>
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          <div className="timer" style={{ color: getTimerColor() }}>
            <div className="timer-circle">
              {timeLeft}s
            </div>
          </div>
        </div>

        <div className="options-section">
          {song.options && song.options.map((option, index) => (
            <button
              key={index}
              className={getOptionClass(option)}
              onClick={() => !submitted && !roundOver && setSelectedAnswer(option)}
              disabled={submitted || roundOver}
            >
              {option}
            </button>
          ))}
        </div>

        {roundOver ? (
          renderRoundResult()
        ) : !submitted ? (
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={!selectedAnswer}
          >
            Submit Answer
          </button>
        ) : (
          <div className="submitted-message">
            <p>Answer locked in! Waiting for the other players…</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameScreen;
