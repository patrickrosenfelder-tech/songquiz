import { Pool, PoolClient } from 'pg';
import { createHash, randomBytes } from 'crypto';
import { MIGRATIONS } from './migrations';

export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface SavedGame {
  code: string;
  kind: 'multiplayer' | 'solo' | 'challenge';
  genreId: number;
  questionMode: string;
  startedAt: Date;
  // Which round of its match this is (multiplayer)
  matchRound?: number;
  players: Array<{
    userId: string | null;
    name: string;
    isGuest: boolean;
    score: number;
    correctCount: number;
  }>;
  songs: Array<{
    trackId: string;
    deezerId?: number;
    title: string;
    artist: string;
    questionType: string;
    correctAnswer: string;
    options: string[];
    // playerIndex points into players
    answers: Array<{ playerIndex: number; answer: string; correct: boolean; points: number; timeMs: number }>;
  }>;
}

export interface SavedMatch {
  code: string;
  roundCount: number;
  startedAt: Date;
  // Ordered by total score; position 0 is the winner
  players: Array<{ userId: string | null; name: string; isGuest: boolean; totalScore: number }>;
  rounds: SavedGame[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  genreId: number;
  achievedAt: Date;
}

export class DisplayNameTakenError extends Error {}

const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function toUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url
  };
}

export class DatabaseService {
  // Shared with SocialRepository
  readonly pool: Pool;

  constructor(connectionString = process.env.DATABASE_URL || 'postgres://localhost/tuneduel') {
    this.pool = new Pool({
      connectionString,
      // Hosted Postgres (Neon etc.) requires TLS; local doesn't
      ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined
    });
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id integer PRIMARY KEY,
          name text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      const { rows } = await client.query('SELECT id FROM schema_migrations');
      const applied = new Set(rows.map(r => r.id));

      for (const migration of MIGRATIONS) {
        if (applied.has(migration.id)) continue;
        await this.inTransaction(client, async () => {
          await client.query(migration.sql);
          await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [migration.id, migration.name]);
        });
        console.log(`Applied migration ${migration.id}: ${migration.name}`);
      }
    } finally {
      client.release();
    }
  }

  async findOrCreateGoogleUser(profile: { sub: string; email?: string; picture?: string }): Promise<User> {
    const { rows } = await this.pool.query(
      `INSERT INTO users (google_sub, email, avatar_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (google_sub) DO UPDATE
         SET email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url, last_seen_at = now()
       RETURNING *`,
      [profile.sub, profile.email || null, profile.picture || null]
    );
    return toUser(rows[0]);
  }

  async setDisplayName(userId: string, displayName: string): Promise<User> {
    try {
      const { rows } = await this.pool.query(
        'UPDATE users SET display_name = $2 WHERE id = $1 RETURNING *',
        [userId, displayName]
      );
      return toUser(rows[0]);
    } catch (err: any) {
      if (err.code === '23505') throw new DisplayNameTakenError();
      throw err;
    }
  }

  // Returns the raw token for the cookie; only its hash is stored
  async createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await this.pool.query(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [hashToken(token), userId, expiresAt]
    );
    return { token, expiresAt };
  }

  async getUserBySession(token: string): Promise<User | null> {
    const { rows } = await this.pool.query(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)]
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  }

  async saveGame(game: SavedGame): Promise<string> {
    const client = await this.pool.connect();
    try {
      return await this.inTransaction(client, () => this.insertGame(client, game, null));
    } finally {
      client.release();
    }
  }

  // A multiplayer match and each of its rounds, all or nothing
  async saveMatch(match: SavedMatch): Promise<string> {
    const client = await this.pool.connect();
    try {
      return await this.inTransaction(client, async () => {
        const { rows } = await client.query(
          'INSERT INTO matches (code, round_count, started_at) VALUES ($1, $2, $3) RETURNING id',
          [match.code, match.roundCount, match.startedAt]
        );
        const matchId = rows[0].id;
        for (const [position, p] of match.players.entries()) {
          await client.query(
            `INSERT INTO match_players (match_id, position, user_id, name, is_guest, total_score)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [matchId, position, p.userId, p.name, p.isGuest, p.totalScore]
          );
        }
        for (const round of match.rounds) {
          await this.insertGame(client, round, matchId);
        }
        return matchId;
      });
    } finally {
      client.release();
    }
  }

  private async insertGame(client: PoolClient, game: SavedGame, matchId: string | null): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO games (code, kind, genre_id, question_mode, song_count, started_at, match_id, match_round)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [game.code, game.kind, game.genreId, game.questionMode, game.songs.length, game.startedAt, matchId, game.matchRound ?? null]
    );
    const gameId = rows[0].id;

    for (const [position, p] of game.players.entries()) {
      await client.query(
        `INSERT INTO game_players (game_id, position, user_id, name, is_guest, score, correct_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [gameId, position, p.userId, p.name, p.isGuest, p.score, p.correctCount]
      );
    }

    for (const [index, s] of game.songs.entries()) {
      const songNumber = index + 1;
      await client.query(
        `INSERT INTO game_songs (game_id, song_number, track_id, deezer_id, title, artist, question_type, correct_answer, options)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [gameId, songNumber, s.trackId, s.deezerId || null, s.title, s.artist, s.questionType, s.correctAnswer, JSON.stringify(s.options)]
      );
      for (const a of s.answers) {
        await client.query(
          `INSERT INTO answers (game_id, song_number, player_position, answer, correct, points, time_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [gameId, songNumber, a.playerIndex, a.answer, a.correct, a.points, a.timeMs]
        );
      }
    }
    return gameId;
  }

  // Each player's best solo game (earliest wins ties), ranked. genreId null = all genres.
  async getLeaderboard(questionMode: string, genreId: number | null, userId: string | null, limit = 50): Promise<{
    entries: LeaderboardEntry[];
    me: LeaderboardEntry | null;
  }> {
    const { rows } = await this.pool.query(
      `WITH best AS (
         SELECT DISTINCT ON (gp.user_id)
           gp.user_id, u.display_name, gp.score, g.genre_id, g.finished_at
         FROM game_players gp
         JOIN games g ON g.id = gp.game_id
         JOIN users u ON u.id = gp.user_id
         WHERE g.kind = 'solo' AND g.question_mode = $1 AND ($2::int IS NULL OR g.genre_id = $2)
         ORDER BY gp.user_id, gp.score DESC, g.finished_at ASC
       ), ranked AS (
         SELECT *, rank() OVER (ORDER BY score DESC, finished_at ASC)::int AS rank FROM best
       )
       SELECT * FROM ranked WHERE rank <= $3 OR user_id = $4 ORDER BY rank`,
      [questionMode, genreId, limit, userId]
    );
    const toEntry = (r: any): LeaderboardEntry => ({
      rank: r.rank,
      userId: r.user_id,
      displayName: r.display_name,
      score: r.score,
      genreId: r.genre_id,
      achievedAt: r.finished_at
    });
    return {
      entries: rows.filter(r => r.rank <= limit).map(toEntry),
      me: userId ? (rows.find(r => r.user_id === userId) ? toEntry(rows.find(r => r.user_id === userId)) : null) : null
    };
  }

  async getBestSoloScore(userId: string, questionMode: string, genreId: number | null): Promise<number | null> {
    const { rows } = await this.pool.query(
      `SELECT max(gp.score) AS best FROM game_players gp JOIN games g ON g.id = gp.game_id
       WHERE gp.user_id = $1 AND g.kind = 'solo' AND g.question_mode = $2 AND ($3::int IS NULL OR g.genre_id = $3)`,
      [userId, questionMode, genreId]
    );
    return rows[0].best;
  }

  async getStats(): Promise<any> {
    const { rows } = await this.pool.query(`
      SELECT
        (SELECT count(*) FROM games)::int AS total_games,
        (SELECT count(*) FROM users WHERE display_name IS NOT NULL)::int AS total_players,
        (SELECT count(*) FROM answers)::int AS total_answers
    `);
    return rows[0];
  }

  close(): Promise<void> {
    return this.pool.end();
  }

  private async inTransaction<T>(client: PoolClient, fn: () => Promise<T>): Promise<T> {
    await client.query('BEGIN');
    try {
      const result = await fn();
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
}
