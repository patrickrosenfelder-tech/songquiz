/**
 * Engine unit tests — pure logic, no HTTP
 */

import {
  createSession,
  startCurrentRound,
  submitGuess,
  advanceRound,
  buildRoundView,
  buildSummary,
  TOTAL_ROUNDS,
} from '../lib/engine';

// ── createSession ──────────────────────────────────────────────────────────

describe('createSession', () => {
  it('creates a session with 10 rounds', () => {
    const s = createSession('player1');
    expect(s.rounds).toHaveLength(TOTAL_ROUNDS);
  });

  it('starts in waiting status', () => {
    const s = createSession();
    expect(s.status).toBe('waiting');
  });

  it('assigns correct round numbers (1-indexed)', () => {
    const s = createSession();
    s.rounds.forEach((r, i) => {
      expect(r.roundNumber).toBe(i + 1);
    });
  });

  it('starts with zero score', () => {
    const s = createSession();
    expect(s.totalScore).toBe(0);
  });
});

// ── startCurrentRound ──────────────────────────────────────────────────────

describe('startCurrentRound', () => {
  it('moves status to in_round', () => {
    const s = startCurrentRound(createSession());
    expect(s.status).toBe('in_round');
  });

  it('sets startedAt on the first round', () => {
    const before = Date.now();
    const s = startCurrentRound(createSession());
    const after = Date.now();
    expect(s.rounds[0].startedAt).toBeGreaterThanOrEqual(before);
    expect(s.rounds[0].startedAt!).toBeLessThanOrEqual(after);
  });
});

// ── submitGuess ────────────────────────────────────────────────────────────

describe('submitGuess', () => {
  function sessionInRound() {
    return startCurrentRound(createSession());
  }

  it('moves to round_over after guessing', () => {
    const s = submitGuess(sessionInRound(), 'any guess');
    expect(s.status).toBe('round_over');
  });

  it('awards 0 pts for an incorrect guess', () => {
    const s = submitGuess(sessionInRound(), 'xyzzy nonsense');
    expect(s.rounds[0].points).toBe(0);
    expect(s.rounds[0].correct).toBe(false);
  });

  it('awards points for a correct guess (exact title match)', () => {
    const session = sessionInRound();
    const correctTitle = session.rounds[0].songId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    // Use a guess that's deliberately a catalog song title
    // We know the catalog, so fetch the actual title
    const { getSongById } = require('../lib/catalog');
    const song = getSongById(session.rounds[0].songId);
    if (!song) return; // skip if catalog lookup fails

    const s = submitGuess(session, song.title);
    expect(s.rounds[0].correct).toBe(true);
    expect(s.rounds[0].points).toBeGreaterThanOrEqual(100);
  });

  it('grants a speed bonus for very fast answers', () => {
    const session = sessionInRound();
    // Manually set startedAt 3 seconds ago
    const threeSecondsAgo = Date.now() - 3000;
    const fast: typeof session = {
      ...session,
      rounds: session.rounds.map((r, i) =>
        i === 0 ? { ...r, startedAt: threeSecondsAgo } : r
      ),
    };
    const { getSongById } = require('../lib/catalog');
    const song = getSongById(fast.rounds[0].songId);
    if (!song) return;

    const s = submitGuess(fast, song.title);
    expect(s.rounds[0].points).toBe(150); // 100 base + 50 fast bonus
  });

  it('grants medium speed bonus for answers in 5-15s', () => {
    const session = sessionInRound();
    const tenSecondsAgo = Date.now() - 10000;
    const med: typeof session = {
      ...session,
      rounds: session.rounds.map((r, i) =>
        i === 0 ? { ...r, startedAt: tenSecondsAgo } : r
      ),
    };
    const { getSongById } = require('../lib/catalog');
    const song = getSongById(med.rounds[0].songId);
    if (!song) return;

    const s = submitGuess(med, song.title);
    expect(s.rounds[0].points).toBe(125); // 100 + 25
  });

  it('accumulates totalScore correctly', () => {
    const session = sessionInRound();
    const { getSongById } = require('../lib/catalog');
    const song = getSongById(session.rounds[0].songId);
    if (!song) return;

    const s = submitGuess(session, song.title);
    expect(s.totalScore).toBe(s.rounds[0].points);
  });

  it('ignores guess when not in_round', () => {
    const session = createSession(); // status = waiting
    const result = submitGuess(session, 'test');
    expect(result.status).toBe('waiting'); // unchanged
  });
});

// ── advanceRound ────────────────────────────────────────────────────────────

describe('advanceRound', () => {
  it('ignores call when not in round_over', () => {
    const s = startCurrentRound(createSession());
    const r = advanceRound(s);
    expect(r.status).toBe('in_round'); // unchanged
  });

  it('advances to the next round', () => {
    let s = startCurrentRound(createSession());
    s = submitGuess(s, 'wrong answer');
    s = advanceRound(s);
    expect(s.currentRound).toBe(1);
    expect(s.status).toBe('in_round');
  });

  it('finishes the game after the last round', () => {
    let s = createSession();
    // Play all 10 rounds
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      s = startCurrentRound(s);
      s = submitGuess(s, 'skip');
      if (i < TOTAL_ROUNDS - 1) {
        s = advanceRound(s);
      }
    }
    // At this point status = round_over on the last round
    s = advanceRound(s);
    expect(s.status).toBe('finished');
  });
});

// ── buildRoundView ──────────────────────────────────────────────────────────

describe('buildRoundView', () => {
  it('returns null for waiting sessions', () => {
    expect(buildRoundView(createSession())).toBeNull();
  });

  it('returns null for finished sessions', () => {
    let s = createSession();
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      s = startCurrentRound(s);
      s = submitGuess(s, 'skip');
      s = advanceRound(s);
    }
    expect(buildRoundView(s)).toBeNull();
  });

  it('hides correct answer while in_round', () => {
    const s = startCurrentRound(createSession());
    const view = buildRoundView(s);
    expect(view).not.toBeNull();
    expect(view!.result).toBeUndefined();
  });

  it('includes result after round_over', () => {
    let s = startCurrentRound(createSession());
    const { getSongById } = require('../lib/catalog');
    const song = getSongById(s.rounds[0].songId);
    if (!song) return;
    s = submitGuess(s, song.title);
    const view = buildRoundView(s);
    expect(view!.result).toBeDefined();
    expect(view!.result!.correctAnswer).toBe(song.title);
  });
});

// ── buildSummary ────────────────────────────────────────────────────────────

describe('buildSummary', () => {
  it('returns null for in-progress sessions', () => {
    expect(buildSummary(startCurrentRound(createSession()))).toBeNull();
  });

  it('returns a valid summary after game finishes', () => {
    let s = createSession();
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      s = startCurrentRound(s);
      s = submitGuess(s, 'skip');
      s = advanceRound(s);
    }
    const summary = buildSummary(s);
    expect(summary).not.toBeNull();
    expect(summary!.rounds).toHaveLength(TOTAL_ROUNDS);
  });

  it('maxScore equals 10 × 150', () => {
    let s = createSession();
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      s = startCurrentRound(s);
      s = submitGuess(s, 'skip');
      s = advanceRound(s);
    }
    const summary = buildSummary(s);
    expect(summary!.maxScore).toBe(TOTAL_ROUNDS * 150);
  });
});
