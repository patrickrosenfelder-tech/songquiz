import { Pool } from 'pg';
import { randomBytes } from 'crypto';

export interface PublicUser {
  id: string;
  displayName: string;
}

export interface ChallengeSong {
  trackId: string;
  deezerId: number | null;
  title: string;
  artist: string;
  questionType: 'artist' | 'title';
  correctAnswer: string;
  options: string[];
}

export interface Challenge {
  id: string;
  code: string;
  challengerId: string;
  challengerName: string;
  targetUserId: string | null;
  genreId: number;
  questionMode: string;
  challengerScore: number;
  expiresAt: Date;
}

const CHALLENGE_DAYS = 7;

// No 0/O or 1/I, like game codes
function challengeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export class SocialRepository {
  constructor(private pool: Pool) {}

  async searchUsers(query: string, excludeUserId: string): Promise<PublicUser[]> {
    const { rows } = await this.pool.query(
      `SELECT id, display_name FROM users
       WHERE display_name IS NOT NULL AND id <> $2 AND lower(display_name) LIKE lower($1) || '%'
       ORDER BY lower(display_name) LIMIT 10`,
      [query.replace(/[%_\\]/g, '\\$&'), excludeUserId]
    );
    return rows.map(r => ({ id: r.id, displayName: r.display_name }));
  }

  async getUser(userId: string): Promise<PublicUser | null> {
    const { rows } = await this.pool.query(
      'SELECT id, display_name FROM users WHERE id = $1 AND display_name IS NOT NULL',
      [userId]
    );
    return rows[0] ? { id: rows[0].id, displayName: rows[0].display_name } : null;
  }

  // Sending a request to someone who already asked you accepts theirs
  async requestFriend(userId: string, targetId: string): Promise<'requested' | 'accepted' | 'already'> {
    const reverse = await this.pool.query(
      `UPDATE friendships SET status = 'accepted'
       WHERE requester_id = $2 AND addressee_id = $1 AND status = 'pending' RETURNING 1`,
      [userId, targetId]
    );
    if (reverse.rowCount) return 'accepted';

    const existing = await this.pool.query(
      `SELECT 1 FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [userId, targetId]
    );
    if (existing.rowCount) return 'already';

    await this.pool.query('INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)', [userId, targetId]);
    return 'requested';
  }

  async acceptFriend(userId: string, requesterId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE friendships SET status = 'accepted'
       WHERE requester_id = $2 AND addressee_id = $1 AND status = 'pending'`,
      [userId, requesterId]
    );
    return !!rowCount;
  }

  // Unfriend, decline, or cancel a request: all remove the row
  async removeFriend(userId: string, otherId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [userId, otherId]
    );
  }

  async listFriends(userId: string): Promise<{ friends: PublicUser[]; incoming: PublicUser[]; outgoing: PublicUser[] }> {
    const { rows } = await this.pool.query(
      `SELECT f.status, f.requester_id = $1 AS outgoing, u.id, u.display_name
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = $1 OR f.addressee_id = $1
       ORDER BY lower(u.display_name)`,
      [userId]
    );
    const toUser = (r: any) => ({ id: r.id, displayName: r.display_name });
    return {
      friends: rows.filter(r => r.status === 'accepted').map(toUser),
      incoming: rows.filter(r => r.status === 'pending' && !r.outgoing).map(toUser),
      outgoing: rows.filter(r => r.status === 'pending' && r.outgoing).map(toUser)
    };
  }

  // The user's own solo game, which is what a challenge is built from
  async getOwnSoloGame(gameId: string, userId: string): Promise<{ id: string; score: number } | null> {
    const { rows } = await this.pool.query(
      `SELECT g.id, gp.score FROM games g JOIN game_players gp ON gp.game_id = g.id
       WHERE g.id = $1 AND g.kind = 'solo' AND gp.user_id = $2`,
      [gameId, userId]
    );
    return rows[0] ? { id: rows[0].id, score: rows[0].score } : null;
  }

  // Reuses an open link challenge for the same game so sharing twice gives the same link
  async createChallenge(challengerId: string, sourceGameId: string, score: number, targetUserId: string | null): Promise<string> {
    if (targetUserId === null) {
      const { rows } = await this.pool.query(
        `SELECT code FROM challenges
         WHERE challenger_id = $1 AND source_game_id = $2 AND target_user_id IS NULL AND expires_at > now()`,
        [challengerId, sourceGameId]
      );
      if (rows[0]) return rows[0].code;
    } else {
      const { rows } = await this.pool.query(
        `SELECT code FROM challenges
         WHERE challenger_id = $1 AND source_game_id = $2 AND target_user_id = $3 AND expires_at > now()`,
        [challengerId, sourceGameId, targetUserId]
      );
      if (rows[0]) return rows[0].code;
    }

    const code = challengeCode();
    await this.pool.query(
      `INSERT INTO challenges (code, challenger_id, target_user_id, source_game_id, challenger_score, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + $6::interval)`,
      [code, challengerId, targetUserId, sourceGameId, score, `${CHALLENGE_DAYS} days`]
    );
    return code;
  }

  async getChallenge(code: string): Promise<Challenge | null> {
    const { rows } = await this.pool.query(
      `SELECT c.*, u.display_name AS challenger_name, g.genre_id, g.question_mode
       FROM challenges c
       JOIN users u ON u.id = c.challenger_id
       JOIN games g ON g.id = c.source_game_id
       WHERE c.code = $1`,
      [code.toUpperCase()]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      code: r.code,
      challengerId: r.challenger_id,
      challengerName: r.challenger_name,
      targetUserId: r.target_user_id,
      genreId: r.genre_id,
      questionMode: r.question_mode,
      challengerScore: r.challenger_score,
      expiresAt: r.expires_at
    };
  }

  async getChallengeSongs(code: string): Promise<ChallengeSong[]> {
    const { rows } = await this.pool.query(
      `SELECT s.* FROM challenges c JOIN game_songs s ON s.game_id = c.source_game_id
       WHERE c.code = $1 ORDER BY s.song_number`,
      [code.toUpperCase()]
    );
    return rows.map(r => ({
      trackId: r.track_id,
      deezerId: r.deezer_id === null ? null : Number(r.deezer_id),
      title: r.title,
      artist: r.artist,
      questionType: r.question_type,
      correctAnswer: r.correct_answer,
      options: r.options
    }));
  }

  async getAttempt(challengeId: string, userId: string): Promise<{ score: number } | null> {
    const { rows } = await this.pool.query(
      'SELECT score FROM challenge_attempts WHERE challenge_id = $1 AND user_id = $2',
      [challengeId, userId]
    );
    return rows[0] ? { score: rows[0].score } : null;
  }

  async recordAttempt(challengeId: string, userId: string | null, name: string, gameId: string, score: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO challenge_attempts (challenge_id, user_id, name, game_id, score)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (challenge_id, user_id) WHERE user_id IS NOT NULL DO NOTHING`,
      [challengeId, userId, name, gameId, score]
    );
  }

  async getInbox(userId: string) {
    const received = await this.pool.query(
      `SELECT c.code, c.challenger_score, c.expires_at, u.display_name AS challenger_name, g.genre_id, g.question_mode
       FROM challenges c
       JOIN users u ON u.id = c.challenger_id
       JOIN games g ON g.id = c.source_game_id
       WHERE c.target_user_id = $1 AND c.expires_at > now()
         AND NOT EXISTS (SELECT 1 FROM challenge_attempts a WHERE a.challenge_id = c.id AND a.user_id = $1)
       ORDER BY c.created_at DESC`,
      [userId]
    );
    const results = await this.pool.query(
      `SELECT a.name, a.score, a.created_at, a.seen_by_challenger, a.user_id IS NULL AS is_guest,
              c.code, c.challenger_score, g.genre_id, g.question_mode
       FROM challenge_attempts a
       JOIN challenges c ON c.id = a.challenge_id
       JOIN games g ON g.id = c.source_game_id
       WHERE c.challenger_id = $1
       ORDER BY a.created_at DESC LIMIT 30`,
      [userId]
    );
    const requests = await this.pool.query(
      `SELECT count(*)::int AS n FROM friendships WHERE addressee_id = $1 AND status = 'pending'`,
      [userId]
    );

    return {
      challenges: received.rows.map(r => ({
        code: r.code,
        challengerName: r.challenger_name,
        challengerScore: r.challenger_score,
        genreId: r.genre_id,
        questionMode: r.question_mode,
        expiresAt: r.expires_at
      })),
      results: results.rows.map(r => ({
        code: r.code,
        name: r.name,
        isGuest: r.is_guest,
        score: r.score,
        yourScore: r.challenger_score,
        genreId: r.genre_id,
        questionMode: r.question_mode,
        playedAt: r.created_at,
        unseen: !r.seen_by_challenger
      })),
      friendRequests: requests.rows[0].n
    };
  }

  async markResultsSeen(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE challenge_attempts a SET seen_by_challenger = true
       FROM challenges c WHERE c.id = a.challenge_id AND c.challenger_id = $1 AND NOT a.seen_by_challenger`,
      [userId]
    );
  }
}
