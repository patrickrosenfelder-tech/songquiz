import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { join } from 'path';

export class DatabaseService {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = join(process.cwd(), 'songquiz.db');
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

    const run = promisify(this.db.run.bind(this.db));

    await run(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        finished_at DATETIME,
        status TEXT DEFAULT 'playing'
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id)
      )
    `);

    await run(`
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

    await run(`
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

    const run = promisify(this.db.run.bind(this.db));

    await run('INSERT INTO games (id, status, finished_at) VALUES (?, ?, ?)', [
      gameId,
      'finished',
      new Date().toISOString()
    ]);

    for (const player of players) {
      const playerId = `${gameId}-${player.userId}`;
      await run('INSERT INTO players (id, game_id, user_id, score) VALUES (?, ?, ?, ?)', [
        playerId,
        gameId,
        player.userId,
        player.score
      ]);
    }
  }

  async getStats(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const all = promisify(this.db.all.bind(this.db));

    const games = await all('SELECT COUNT(*) as total_games FROM games');
    const players = await all('SELECT COUNT(*) as total_players FROM players');
    const answers = await all('SELECT COUNT(*) as total_answers FROM answers');
    const topScores = await all(`
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
