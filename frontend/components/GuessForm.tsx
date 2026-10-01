/**
 * GuessForm — text input + submit for song/artist guessing
 */

import { useState, useRef, useEffect, FormEvent } from 'react';

interface Props {
  onSubmit: (guess: string) => void;
  disabled?: boolean;
}

export default function GuessForm({ onSubmit, disabled }: Props) {
  const [guess, setGuess] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on each new round
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = guess.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setGuess('');
  };

  return (
    <form className="guess-form" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        className="guess-input"
        placeholder="Song title or artist name…"
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        disabled={disabled}
        maxLength={120}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="submit"
        className="guess-submit"
        disabled={disabled || !guess.trim()}
      >
        Guess →
      </button>
    </form>
  );
}
