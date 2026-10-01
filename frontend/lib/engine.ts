/**
 * Game Engine — pure logic, no I/O
 *
 * Scoring model:
 *   - Correct answer:            100 pts base
 *   - Speed bonus (<5s):         +50 pts  (max 150)
 *   - Speed bonus (5-15s):       +25 pts
 *   - No speed bonus (>15s):       0 pts bonus
 *   - Wrong / no answer:           0 pts
 *
 * Multiplayer-readiness:
 *   - Session is a pure data object — no in-memory singleton
 *   - All mutations return a NEW session object (immutable pattern)
 *   - Ready to store in Redis/DB for multiplayer
 */

import { v4 as uuidv4 } from 'uuid';
import { GameSession, Round, RoundView, SessionSummary, SessionStatus } from './types';
import { pickRandomSongs, getSongById } from './catalog';

export const TOTAL_ROUNDS = 10;
const BASE_SCORE = 100;
const SPEED_BONUS_FAST = 50;   // < 5 seconds
const SPEED_BONUS_MED = 25;    // < 15 seconds

/** Create a brand-new game session */
export function createSession(playerId: string = 'anonymous'): GameSession {
  const songs = pickRandomSongs(TOTAL_ROUNDS);
  const now = Date.now();

  const rounds: Round[] = songs.map((song, idx) => ({
    roundNumber: idx + 1,
    songId: song.id,
    guess: null,
    correct: null,
    points: 0,
    startedAt: null,
    answeredAt: null,
  }));

  return {
    id: uuidv4(),
    status: 'waiting',
    songIds: songs.map((s) => s.id),
    rounds,
    currentRound: 0,
    totalScore: 0,
    createdAt: now,
    updatedAt: now,
    playerId,
  };
}

/** Mark the current round as started (clip is playing) */
export function startCurrentRound(session: GameSession): GameSession {
  if (session.status === 'finished') return session;

  const now = Date.now();
  const rounds = session.rounds.map((r, i) =>
    i === session.currentRound ? { ...r, startedAt: now } : r
  );

  return {
    ...session,
    status: 'in_round',
    rounds,
    updatedAt: now,
  };
}

/** Normalise a guess for comparison */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check whether `guess` is correct for the given song */
function isCorrect(guess: string, songId: string): boolean {
  const song = getSongById(songId);
  if (!song) return false;

  const norm = normalise(guess);
  if (!norm) return false;

  const candidates = [
    normalise(song.title),
    normalise(song.artist),
    ...song.aliases.map(normalise),
  ];

  // Exact match
  if (candidates.includes(norm)) return true;

  // Substring match — title or artist fully contained in guess or vice-versa
  const normTitle = normalise(song.title);
  const normArtist = normalise(song.artist);
  if (norm.includes(normTitle) || normTitle.includes(norm)) return true;
  if (norm.includes(normArtist) || normArtist.includes(norm)) return true;

  return false;
}

/** Calculate speed bonus points */
function calcSpeedBonus(startedAt: number | null, answeredAt: number): number {
  if (startedAt === null) return 0;
  const elapsed = (answeredAt - startedAt) / 1000; // seconds
  if (elapsed < 5) return SPEED_BONUS_FAST;
  if (elapsed < 15) return SPEED_BONUS_MED;
  return 0;
}

/** Submit a guess for the current round */
export function submitGuess(session: GameSession, guess: string): GameSession {
  if (session.status !== 'in_round') return session;

  const now = Date.now();
  const roundIdx = session.currentRound;
  const round = session.rounds[roundIdx];

  const correct = isCorrect(guess, round.songId);
  const points = correct
    ? BASE_SCORE + calcSpeedBonus(round.startedAt, now)
    : 0;

  const updatedRound: Round = {
    ...round,
    guess,
    correct,
    points,
    answeredAt: now,
  };

  const rounds = session.rounds.map((r, i) => (i === roundIdx ? updatedRound : r));
  const totalScore = rounds.reduce((sum, r) => sum + r.points, 0);

  return {
    ...session,
    status: 'round_over',
    rounds,
    totalScore,
    updatedAt: now,
  };
}

/** Advance to the next round (or finish the session) */
export function advanceRound(session: GameSession): GameSession {
  if (session.status !== 'round_over') return session;

  const nextRound = session.currentRound + 1;
  const now = Date.now();

  if (nextRound >= TOTAL_ROUNDS) {
    return {
      ...session,
      status: 'finished',
      updatedAt: now,
    };
  }

  // Start the next round immediately (clip starts playing)
  const rounds = session.rounds.map((r, i) =>
    i === nextRound ? { ...r, startedAt: now } : r
  );

  return {
    ...session,
    currentRound: nextRound,
    status: 'in_round',
    rounds,
    updatedAt: now,
  };
}

/** Build the client-facing RoundView (hides song answer until round_over/finished) */
export function buildRoundView(session: GameSession): RoundView | null {
  if (session.status === 'waiting') return null;
  if (session.status === 'finished') return null;

  const round = session.rounds[session.currentRound];
  const song = getSongById(round.songId);
  if (!song) return null;

  const view: RoundView = {
    roundNumber: round.roundNumber,
    totalRounds: TOTAL_ROUNDS,
    clipUrl: song.clipUrl,
    status: session.status,
    totalScore: session.totalScore,
  };

  if (session.status === 'round_over' && round.correct !== null) {
    view.result = {
      correct: round.correct,
      points: round.points,
      correctAnswer: song.title,
      artistName: song.artist,
      albumArtUrl: song.albumArtUrl,
    };
  }

  return view;
}

/** Build the session summary (only valid when status === 'finished') */
export function buildSummary(session: GameSession): SessionSummary | null {
  if (session.status !== 'finished') return null;

  return {
    sessionId: session.id,
    totalScore: session.totalScore,
    maxScore: TOTAL_ROUNDS * (BASE_SCORE + SPEED_BONUS_FAST),
    rounds: session.rounds.map((r) => {
      const song = getSongById(r.songId);
      return {
        roundNumber: r.roundNumber,
        songTitle: song?.title ?? '?',
        artistName: song?.artist ?? '?',
        guess: r.guess,
        correct: r.correct ?? false,
        points: r.points,
      };
    }),
  };
}
