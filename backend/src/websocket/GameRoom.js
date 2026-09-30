const ROUND_DURATION_MS = 15000;

/**
 * Holds the authoritative state for one game: connected players, scores,
 * and the current round's track. The correct answer is kept server-side
 * only and never serialized into broadcast state, so clients can't peek
 * at it in devtools while guessing.
 */
class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map(); // playerId -> { ws, name, score }
    this.currentRound = null; // { track, roundNumber, endsAt, guessedCorrectlyBy: Set, timer }
    this.roundNumber = 0;
  }

  get isEmpty() {
    return this.players.size === 0;
  }

  addPlayer(playerId, ws, name) {
    this.players.set(playerId, { ws, name, score: 0 });
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  publicState() {
    return {
      roomId: this.roomId,
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id,
        name: p.name,
        score: p.score,
      })),
      round: this.currentRound
        ? {
            roundNumber: this.currentRound.roundNumber,
            previewUrl: this.currentRound.track.previewUrl,
            endsAt: this.currentRound.endsAt,
          }
        : null,
    };
  }

  startRound(track, onRoundEnd) {
    if (this.currentRound && this.currentRound.timer) {
      clearTimeout(this.currentRound.timer);
    }

    this.roundNumber += 1;
    const roundNumber = this.roundNumber;
    const endsAt = Date.now() + ROUND_DURATION_MS;

    const timer = setTimeout(() => {
      if (this.currentRound && this.currentRound.roundNumber === roundNumber) {
        onRoundEnd(this.endRound());
      }
    }, ROUND_DURATION_MS);

    this.currentRound = {
      track,
      roundNumber,
      endsAt,
      guessedCorrectlyBy: new Set(),
      timer,
    };

    return this.currentRound;
  }

  /**
   * @returns {{ track, roundNumber, correctPlayerIds }|null} the round that
   *   just ended, or null if no round was active.
   */
  endRound() {
    if (!this.currentRound) return null;
    if (this.currentRound.timer) clearTimeout(this.currentRound.timer);

    const ended = this.currentRound;
    this.currentRound = null;
    return {
      track: ended.track,
      roundNumber: ended.roundNumber,
      correctPlayerIds: Array.from(ended.guessedCorrectlyBy),
    };
  }

  /**
   * @returns {'correct'|'already-scored'|'incorrect'|'no-round'}
   */
  submitGuess(playerId, guessText) {
    if (!this.currentRound) return 'no-round';
    if (this.currentRound.guessedCorrectlyBy.has(playerId)) return 'already-scored';

    const isCorrect = isFuzzyMatch(guessText, this.currentRound.track.title) ||
      isFuzzyMatch(guessText, this.currentRound.track.artist);

    if (!isCorrect) return 'incorrect';

    this.currentRound.guessedCorrectlyBy.add(playerId);
    const player = this.players.get(playerId);
    if (player) {
      const order = this.currentRound.guessedCorrectlyBy.size;
      player.score += Math.max(10 - (order - 1) * 2, 2); // faster guesses score more
    }
    return 'correct';
  }

  broadcast(message, exceptPlayerId = null) {
    const payload = JSON.stringify(message);
    for (const [playerId, player] of this.players) {
      if (playerId === exceptPlayerId) continue;
      if (player.ws.readyState === player.ws.OPEN) {
        player.ws.send(payload);
      }
    }
  }
}

function isFuzzyMatch(guess, answer) {
  if (!guess || !answer) return false;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const normalizedGuess = normalize(guess);
  const normalizedAnswer = normalize(answer);
  if (!normalizedGuess) return false;
  return normalizedAnswer === normalizedGuess || normalizedAnswer.includes(normalizedGuess);
}

module.exports = GameRoom;
