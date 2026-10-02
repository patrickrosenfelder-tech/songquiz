import { AudioService } from '../services/audioService';
import { v4 as uuidv4 } from 'uuid';

export interface Song {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  correctAnswer: string;
  options: string[];
}

export interface GameRound {
  roundNumber: number;
  song: Song;
  startTime: number;
  endTime?: number;
  answers: Map<string, { answer: string; timeSpent: number; correct: boolean; points: number }>;
}

export interface Player {
  userId: string;
  clientId: string;
  score: number;
  ready: boolean;
}

export interface Game {
  id: string;
  players: Player[];
  rounds: GameRound[];
  currentRound: number;
  totalRounds: number;
  status: 'waiting' | 'playing' | 'finished';
  currentSong?: Song;
}

export class GameManager {
  private games: Map<string, Game> = new Map();
  private audioService: AudioService;
  private readonly TOTAL_ROUNDS = 10;
  readonly ANSWER_TIMEOUT = 30000; // 30 seconds

  constructor() {
    this.audioService = new AudioService();
  }

  joinGame(gameId: string, userId: string, clientId: string): Game {
    let game = this.games.get(gameId);

    if (!game) {
      game = {
        id: gameId,
        players: [],
        rounds: [],
        currentRound: 0,
        totalRounds: this.TOTAL_ROUNDS,
        status: 'waiting'
      };
      this.games.set(gameId, game);
    }

    if (!game.players.find(p => p.userId === userId)) {
      game.players.push({
        userId,
        clientId,
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
      }
    }
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

    const playedIds = game.rounds.map(r => r.song.id);
    const song = await this.audioService.getRandomSong(playedIds);
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

  getGameState(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }
}
