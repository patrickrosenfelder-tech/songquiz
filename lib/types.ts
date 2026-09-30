// Core domain types for TuneDuel game loop

/** A song in the catalog */
export interface Song {
  id: string;
  title: string;
  artist: string;
  /** URL to a short audio clip (30s preview) */
  clipUrl: string;
  /** Album art for reveal */
  albumArtUrl?: string;
  /** Accepted alternative answers (lowercase) */
  aliases: string[];
}

/** Per-round state */
export interface Round {
  roundNumber: number; // 1-indexed
  songId: string;
  /** The guess submitted by the player (null = not answered yet) */
  guess: string | null;
  /** Whether the guess was correct */
  correct: boolean | null;
  /** Points earned this round (0 or positive) */
  points: number;
  /** ms timestamp when clip started playing (set server-side) */
  startedAt: number | null;
  /** ms timestamp when guess was submitted */
  answeredAt: number | null;
}

/** Game session states */
export type SessionStatus =
  | 'waiting'     // session created, not started
  | 'in_round'    // a round is active, clip playing / waiting for guess
  | 'round_over'  // result shown, ready to advance
  | 'finished';   // all 10 rounds done

/** Full game session */
export interface GameSession {
  id: string;
  status: SessionStatus;
  /** Ordered song IDs for this session (10 items) */
  songIds: string[];
  rounds: Round[];
  /** 0-indexed pointer to current round */
  currentRound: number;
  totalScore: number;
  createdAt: number;
  updatedAt: number;
  /** For multiplayer expansion: player identifier */
  playerId: string;
}

/** What the client sees for the current round (no answer spoilers) */
export interface RoundView {
  roundNumber: number;
  totalRounds: number;
  clipUrl: string;
  status: SessionStatus;
  totalScore: number;
  /** Only populated after guess submitted */
  result?: {
    correct: boolean;
    points: number;
    correctAnswer: string;
    artistName: string;
    albumArtUrl?: string;
  };
}

/** Summary at end of session */
export interface SessionSummary {
  sessionId: string;
  totalScore: number;
  maxScore: number;
  rounds: Array<{
    roundNumber: number;
    songTitle: string;
    artistName: string;
    guess: string | null;
    correct: boolean;
    points: number;
  }>;
}

// API request/response shapes

export interface StartSessionRequest {
  playerId?: string;
}

export interface StartSessionResponse {
  sessionId: string;
  roundView: RoundView;
}

export interface SubmitGuessRequest {
  sessionId: string;
  guess: string;
}

export interface SubmitGuessResponse {
  roundView: RoundView;
}

export interface NextRoundRequest {
  sessionId: string;
}

export interface NextRoundResponse {
  roundView: RoundView;
}

export interface GetSessionResponse {
  session: GameSession;
  roundView: RoundView | null;
  summary: SessionSummary | null;
}
