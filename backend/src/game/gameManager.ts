import { AudioService, GENRES, QuestionType, Song, Track } from '../services/audioService';
import { SavedGame, SavedMatch } from '../database/database';

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
  // Multiplayer only: how many 7-song rounds the match has
  roundCount: number;
}

export const MAX_MATCH_ROUNDS = 5;

export interface Game {
  id: string;
  kind: 'multiplayer' | 'solo';
  hostClientId: string;
  settings: GameSettings;
  players: Player[];
  // Songs of the current match round ("round" in the UI = 7 songs; GameRound = one song)
  rounds: GameRound[];
  currentRound: number;
  totalRounds: number;
  status: 'waiting' | 'picking' | 'playing' | 'finished';
  currentSong?: Song;
  songPool: Track[];
  nextTrackIndex: number;
  startedAt?: Date;
  matchRound: number;
  matchRounds: number;
  matchStartedAt?: Date;
  // Join order at match start; players take turns picking genre and mode
  pickerOrder: string[];
  pickerClientId?: string;
  completedRounds: SavedGame[];
  roundStartScores: Map<string, number>;
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
        settings: { genreId: 0, mode: 'artist', roundCount: 3 },
        players: [],
        rounds: [],
        currentRound: 0,
        totalRounds: this.TOTAL_ROUNDS,
        status: 'waiting',
        songPool: [],
        nextTrackIndex: 0,
        matchRound: 0,
        matchRounds: 1,
        pickerOrder: [],
        completedRounds: [],
        roundStartScores: new Map()
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
    if (settings.roundCount !== undefined && Number.isInteger(settings.roundCount)
      && settings.roundCount >= 1 && settings.roundCount <= MAX_MATCH_ROUNDS) {
      game.settings.roundCount = settings.roundCount;
    }
    return true;
  }

  startMatch(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');
    game.pickerOrder = game.players.map(p => p.clientId);
    game.matchRounds = game.kind === 'solo' ? 1 : game.settings.roundCount;
    game.matchRound = 0;
    game.matchStartedAt = new Date();
    game.completedRounds = [];
  }

  // Moves to the next match round and returns who picks its genre and mode
  beginPick(gameId: string): Player | null {
    const game = this.games.get(gameId);
    if (!game) return null;
    game.matchRound++;
    game.status = 'picking';
    game.players.forEach(p => { p.ready = false; });
    return this.assignPicker(game);
  }

  // If the picker left, the next player in the rotation takes over
  reassignPickerIfGone(gameId: string): Player | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'picking') return null;
    if (game.players.some(p => p.clientId === game.pickerClientId)) return null;
    return this.assignPicker(game);
  }

  private assignPicker(game: Game): Player | null {
    const present = game.pickerOrder
      .map(id => game.players.find(p => p.clientId === id))
      .filter((p): p is Player => !!p);
    // Players who joined after the match started (none today) fall back to join order
    const order = present.length > 0 ? present : game.players;
    if (order.length === 0) return null;
    const picker = order[(game.matchRound - 1) % order.length];
    game.pickerClientId = picker.clientId;
    return picker;
  }

  // Only the current picker can choose, once, while picking
  chooseRound(gameId: string, clientId: string | null, choice: { genreId?: number; mode?: string }): boolean {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'picking') return false;
    if (clientId !== null && clientId !== game.pickerClientId) return false;

    const genreId = GENRES.some(g => g.id === choice.genreId) ? choice.genreId! : game.settings.genreId;
    const mode = ['artist', 'title', 'mix'].includes(choice.mode || '') ? choice.mode as GameMode : game.settings.mode;
    game.settings.genreId = genreId;
    game.settings.mode = mode;
    game.status = 'playing';
    return true;
  }

  // Used when the picker doesn't choose in time
  autoChooseRound(gameId: string): boolean {
    const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
    const modes: GameMode[] = ['artist', 'title', 'mix'];
    return this.chooseRound(gameId, null, { genreId: genre.id, mode: modes[Math.floor(Math.random() * modes.length)] });
  }

  async prepareGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');
    game.songPool = await this.audioService.getSongPool(game.settings.genreId);
    game.startedAt = new Date();
    game.nextTrackIndex = 0;
    game.rounds = [];
    game.currentRound = 0;
    game.roundStartScores = new Map(game.players.map(p => [p.clientId, p.score]));
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

  // Starts the next song of the current match round; null when the round has no more songs
  async startNextRound(gameId: string): Promise<Game | null> {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    if (game.currentRound >= game.totalRounds) {
      return null;
    }

    game.currentRound++;
    game.status = 'playing';

    const song = await this.nextPlayableSong(game);
    if (!song) {
      // Ran out of songs with audio; end this round after the songs played so far
      game.currentRound--;
      game.totalRounds = game.currentRound;
      return null;
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

  isLastMatchRound(gameId: string): boolean {
    const game = this.games.get(gameId);
    return !!game && game.matchRound >= game.matchRounds;
  }

  // Stores the finished match round for saving at the end of the match
  completeMatchRound(gameId: string): void {
    const saved = this.toSavedGame(gameId);
    const game = this.games.get(gameId);
    if (game && saved) game.completedRounds.push(saved);
  }

  finishGame(gameId: string): Array<{ player: string; score: number }> {
    const game = this.games.get(gameId);
    if (!game) return [];
    game.status = 'finished';
    return [...game.players]
      .sort((a, b) => b.score - a.score)
      .map(p => ({ player: p.userId, score: p.score }));
  }

  // Snapshot of the current match round in the shape the database stores; scores are this round's only
  toSavedGame(gameId: string): SavedGame | null {
    const game = this.games.get(gameId);
    if (!game || game.rounds.length === 0) return null;

    const roundScore = (p: Player) => p.score - (game.roundStartScores.get(p.clientId) ?? 0);
    const players = [...game.players].sort((a, b) => roundScore(b) - roundScore(a));
    const indexByClient = new Map(players.map((p, i) => [p.clientId, i]));

    return {
      code: game.id,
      kind: game.kind,
      genreId: game.settings.genreId,
      questionMode: game.settings.mode,
      startedAt: game.startedAt || new Date(),
      matchRound: game.matchRound,
      players: players.map(p => ({
        userId: p.accountId,
        name: p.userId,
        isGuest: p.isGuest,
        score: roundScore(p),
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

  toSavedMatch(gameId: string): SavedMatch | null {
    const game = this.games.get(gameId);
    if (!game || game.completedRounds.length === 0) return null;
    return {
      code: game.id,
      roundCount: game.completedRounds.length,
      startedAt: game.matchStartedAt || new Date(),
      players: [...game.players]
        .sort((a, b) => b.score - a.score)
        .map(p => ({ userId: p.accountId, name: p.userId, isGuest: p.isGuest, totalScore: p.score })),
      rounds: game.completedRounds
    };
  }

  getGameState(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }
}
