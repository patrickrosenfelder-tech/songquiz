import { AudioService, GENRES, QuestionType, Song, Track } from '../services/audioService';
import { SavedGame } from '../database/database';

export interface GameRound {
  roundNumber: number;
  song: Song;
  startTime: number;
  endTime?: number;
  answers: Map<string, { answer: string; timeSpent: number; correct: boolean; points: number }>;
}

export interface Player {
  // Display name: the account's name, or the name a guest typed
  userId: string;
  clientId: string;
  accountId: string | null;
  isGuest: boolean;
  score: number;
  ready: boolean;
}

export type GameMode = 'artist' | 'title' | 'mix';

export interface GameSettings {
  genreId: number;
  mode: GameMode;
}

export interface Game {
  id: string;
  kind: 'multiplayer' | 'solo';
  hostClientId: string;
  settings: GameSettings;
  players: Player[];
  rounds: GameRound[];
  currentRound: number;
  totalRounds: number;
  status: 'waiting' | 'playing' | 'finished';
  currentSong?: Song;
  songPool: Track[];
  nextTrackIndex: number;
  startedAt?: Date;
}

export class GameManager {
  private games: Map<string, Game> = new Map();
  private audioService: AudioService;
  private readonly TOTAL_ROUNDS = 7;
  readonly ANSWER_TIMEOUT = 30000; // 30 seconds

  constructor() {
    this.audioService = new AudioService();
  }

  // Short, easy-to-type code; no 0/O or 1/I to avoid mix-ups
  generateGameCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.games.has(code));
    return code;
  }

  joinGame(gameId: string, userId: string, clientId: string, accountId: string | null = null, kind: Game['kind'] = 'multiplayer'): Game {
    let game = this.games.get(gameId);

    if (!game) {
      game = {
        id: gameId,
        kind,
        hostClientId: clientId,
        settings: { genreId: 0, mode: 'artist' },
        players: [],
        rounds: [],
        currentRound: 0,
        totalRounds: this.TOTAL_ROUNDS,
        status: 'waiting',
        songPool: [],
        nextTrackIndex: 0
      };
      this.games.set(gameId, game);
    }

    if (!game.players.find(p => p.userId === userId)) {
      game.players.push({
        userId,
        clientId,
        accountId,
        isGuest: !accountId,
        score: 0,
        ready: false
      });
    }

    return game;
  }

  removePlayer(gameId: string, clientId: string): void {
    const game = this.games.get(gameId);
    if (game) {
      game.players = game.players.filter(p => p.clientId !== clientId);
      if (game.players.length === 0) {
        this.games.delete(gameId);
      } else if (game.hostClientId === clientId) {
        game.hostClientId = game.players[0].clientId;
      }
    }
  }

  // Only the host can change settings, and only before the game starts
  updateSettings(gameId: string, clientId: string, settings: Partial<GameSettings>): boolean {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'waiting' || game.hostClientId !== clientId) return false;

    if (settings.genreId !== undefined && GENRES.some(g => g.id === settings.genreId)) {
      game.settings.genreId = settings.genreId;
    }
    if (settings.mode && ['artist', 'title', 'mix'].includes(settings.mode)) {
      game.settings.mode = settings.mode;
    }
    return true;
  }

  async prepareGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');
    game.songPool = await this.audioService.getSongPool(game.settings.genreId);
    game.startedAt = new Date();
    game.nextTrackIndex = 0;
    game.totalRounds = Math.min(this.TOTAL_ROUNDS, game.songPool.length);
  }

  setPlayerReady(gameId: string, clientId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const player = game.players.find(p => p.clientId === clientId);
    if (player) {
      player.ready = true;
    }

    return game.players.every(p => p.ready);
  }

  async startNextRound(gameId: string): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    if (game.currentRound >= game.totalRounds) {
      game.status = 'finished';
      return game;
    }

    game.currentRound++;
    game.status = 'playing';

    game.players.forEach(p => {
      p.ready = false;
    });

    const song = await this.nextPlayableSong(game);
    if (!song) {
      // Ran out of songs with audio; end the game after the rounds played so far
      game.currentRound--;
      game.totalRounds = game.currentRound;
      game.status = 'finished';
      return game;
    }
    game.currentSong = song;

    const round: GameRound = {
      roundNumber: game.currentRound,
      song,
      startTime: Date.now(),
      answers: new Map()
    };

    game.rounds.push(round);

    return game;
  }

  // The pool is already shuffled; skip tracks that have no preview on Deezer or iTunes
  private async nextPlayableSong(game: Game): Promise<Song | null> {
    while (game.nextTrackIndex < game.songPool.length) {
      const track = game.songPool[game.nextTrackIndex++];
      const audioUrl = await this.audioService.getPreviewUrl(track);
      if (!audioUrl) {
        console.warn(`No preview for "${track.artist} - ${track.title}", skipping`);
        continue;
      }
      const questionType: QuestionType = game.settings.mode === 'mix'
        ? (Math.random() < 0.5 ? 'artist' : 'title')
        : game.settings.mode;
      return this.audioService.buildSong(track, game.songPool, questionType, audioUrl);
    }
    return null;
  }

  // Returns null if there is no open round or the player already answered
  recordAnswer(gameId: string, clientId: string, answer: string): { correct: boolean; points: number } | null {
    const round = this.getCurrentRound(gameId);
    if (!round || round.endTime !== undefined || round.answers.has(clientId)) {
      return null;
    }

    const game = this.games.get(gameId)!;
    const timeSpent = Date.now() - round.startTime;
    const isCorrect = answer.toLowerCase() === round.song.correctAnswer.toLowerCase();

    // 1000 points for an instant answer, dropping to 0 at the 30s limit
    const points = isCorrect ? Math.max(0, 1000 - Math.floor(timeSpent / 30)) : 0;

    const player = game.players.find(p => p.clientId === clientId);
    if (player) {
      player.score += points;
    }

    round.answers.set(clientId, {
      answer,
      timeSpent,
      correct: isCorrect,
      points
    });

    return { correct: isCorrect, points };
  }

  getCurrentRound(gameId: string): GameRound | undefined {
    const game = this.games.get(gameId);
    return game?.rounds[game.rounds.length - 1];
  }

  allPlayersAnswered(gameId: string): boolean {
    const game = this.games.get(gameId);
    const round = this.getCurrentRound(gameId);
    if (!game || !round) return false;
    return game.players.every(p => round.answers.has(p.clientId));
  }

  // Closes the current round; returns null if it was already closed
  endCurrentRound(gameId: string): GameRound | null {
    const round = this.getCurrentRound(gameId);
    if (!round || round.endTime !== undefined) return null;
    round.endTime = Date.now();
    return round;
  }

  isLastRound(gameId: string): boolean {
    const game = this.games.get(gameId);
    return !!game && game.currentRound >= game.totalRounds;
  }

  finishGame(gameId: string): Array<{ player: string; score: number }> {
    const game = this.games.get(gameId);
    if (!game) return [];
    game.status = 'finished';
    return [...game.players]
      .sort((a, b) => b.score - a.score)
      .map(p => ({ player: p.userId, score: p.score }));
  }

  // Snapshot of a finished game in the shape the database stores
  toSavedGame(gameId: string): SavedGame | null {
    const game = this.games.get(gameId);
    if (!game || game.rounds.length === 0) return null;

    const players = [...game.players].sort((a, b) => b.score - a.score);
    const indexByClient = new Map(players.map((p, i) => [p.clientId, i]));

    return {
      code: game.id,
      kind: game.kind,
      genreId: game.settings.genreId,
      questionMode: game.settings.mode,
      startedAt: game.startedAt || new Date(),
      players: players.map(p => ({
        userId: p.accountId,
        name: p.userId,
        isGuest: p.isGuest,
        score: p.score,
        correctCount: game.rounds.filter(r => r.answers.get(p.clientId)?.correct).length
      })),
      songs: game.rounds.map(r => ({
        trackId: r.song.id,
        deezerId: game.songPool.find(t => t.id === r.song.id)?.deezerId,
        title: r.song.title,
        artist: r.song.artist,
        questionType: r.song.questionType,
        correctAnswer: r.song.correctAnswer,
        options: r.song.options,
        // Players who left mid-game aren't saved, so neither are their answers
        answers: Array.from(r.answers.entries())
          .filter(([clientId]) => indexByClient.has(clientId))
          .map(([clientId, a]) => ({
            playerIndex: indexByClient.get(clientId)!,
            answer: a.answer,
            correct: a.correct,
            points: a.points,
            timeMs: a.timeSpent
          }))
      }))
    };
  }

  getGameState(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }
}
