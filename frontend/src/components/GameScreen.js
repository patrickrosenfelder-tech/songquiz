import React, { useState, useEffect } from 'react';
import './GameScreen.css';

function GameScreen({ song, round, totalRounds, score, onAnswerSubmit }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  useEffect(() => {
    setTimeLeft(30);
    setSelectedAnswer(null);
    setSubmitted(false);
  }, [song]);

  const handleSubmit = () => {
    if (!submitted) {
      onAnswerSubmit(selectedAnswer || 'skipped');
      setSubmitted(true);
    }
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
              <audio controls autoPlay>
                <source src={song.audioUrl} type="audio/mpeg" />
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
              className={`option-button ${selectedAnswer === option ? 'selected' : ''} ${submitted ? 'disabled' : ''}`}
              onClick={() => !submitted && setSelectedAnswer(option)}
              disabled={submitted}
            >
              {option}
            </button>
          ))}
        </div>

        {!submitted && (
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={!selectedAnswer}
          >
            Submit Answer
          </button>
        )}

        {submitted && (
          <div className="submitted-message">
            <p>Answer submitted! Waiting for next song...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameScreen;
