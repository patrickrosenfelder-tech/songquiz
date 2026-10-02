import sqlite3 from 'sqlite3';
import { join } from 'path';

export class DatabaseService {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    // src/database or dist/database -> backend/songquiz.db
    this.dbPath = join(__dirname, '..', '..', 'songquiz.db');
  }

  private run(sql: string, params: unknown[] = []): Promise<void> {
    const db = this.db;
    if (!db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      db.run(sql, params, (err) => (err ? reject(err) : resolve()));
    });
  }

  private all<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = this.db;
    if (!db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
    });
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.createTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.run(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        finished_at DATETIME,
        status TEXT DEFAULT 'playing'
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id)
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS rounds (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        song_title TEXT NOT NULL,
        artist TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id)
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS answers (
        id TEXT PRIMARY KEY,
        round_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        answer TEXT NOT NULL,
        correct INTEGER DEFAULT 0,
        points INTEGER DEFAULT 0,
        time_spent INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (round_id) REFERENCES rounds(id),
        FOREIGN KEY (player_id) REFERENCES players(id)
      )
    `);
  }

  async recordGame(gameId: string, players: Array<{ userId: string; score: number }>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.run('INSERT INTO games (id, status, finished_at) VALUES (?, ?, ?)', [
      gameId,
      'finished',
      new Date().toISOString()
    ]);

    for (const player of players) {
      const playerId = `${gameId}-${player.userId}`;
      await this.run('INSERT INTO players (id, game_id, user_id, score) VALUES (?, ?, ?, ?)', [
        playerId,
        gameId,
        player.userId,
        player.score
      ]);
    }
  }

  async getStats(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const games = await this.all('SELECT COUNT(*) as total_games FROM games');
    const players = await this.all('SELECT COUNT(*) as total_players FROM players');
    const answers = await this.all('SELECT COUNT(*) as total_answers FROM answers');
    const topScores = await this.all(`
      SELECT user_id, MAX(score) as high_score
      FROM players
      GROUP BY user_id
      ORDER BY high_score DESC
      LIMIT 10
    `);

    return {
      total_games: games[0]?.total_games || 0,
      total_players: players[0]?.total_players || 0,
      total_answers: answers[0]?.total_answers || 0,
      top_scores: topScores
    };
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
