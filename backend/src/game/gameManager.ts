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
  private readonly ANSWER_TIMEOUT = 30000; // 30 seconds

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

  startNextRound(gameId: string): Game {
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

    const song = this.audioService.getRandomSongSync();
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

  recordAnswer(gameId: string, clientId: string, answer: string, timeSpent: number): { correct: boolean; points: number } {
    const game = this.games.get(gameId);
    if (!game || game.rounds.length === 0) {
      return { correct: false, points: 0 };
    }

    const currentRound = game.rounds[game.rounds.length - 1];
    const isCorrect = answer.toLowerCase() === currentRound.song.correctAnswer.toLowerCase();

    const points = isCorrect ? Math.max(0, 1000 - Math.floor(timeSpent / 30)) : 0;

    const player = game.players.find(p => p.clientId === clientId);
    if (player) {
      player.score += points;
    }

    currentRound.answers.set(clientId, {
      answer,
      timeSpent,
      correct: isCorrect,
      points
    });

    return { correct: isCorrect, points };
  }

  getGameState(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }
}
