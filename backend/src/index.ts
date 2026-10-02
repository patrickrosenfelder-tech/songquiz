import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { GameManager } from './game/gameManager';
import { DatabaseService } from './database/database';
import { GENRES } from './services/audioService';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const gameManager = new GameManager();
const db = new DatabaseService();

db.initialize().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Database initialization failed:', err);
});

interface GameClient {
  id: string;
  gameId: string;
  userId: string;
  send: (message: string) => void;
}

const clients: Map<string, GameClient> = new Map();

const NEXT_ROUND_DELAY = 5000;
// Extra time so a client's own timeout answer arrives before the server closes the round
const ROUND_GRACE_PERIOD = 1500;
const roundTimers: Map<string, NodeJS.Timeout> = new Map();
// Games loading their song pool, so a second ready message can't start them twice
const startingGames: Set<string> = new Set();

function setRoundTimer(gameId: string, fn: () => void, delay: number) {
  clearRoundTimer(gameId);
  roundTimers.set(gameId, setTimeout(fn, delay));
}

function clearRoundTimer(gameId: string) {
  const timer = roundTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    roundTimers.delete(gameId);
  }
}

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  console.log(`Client connected: ${clientId}`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(clientId, message, ws);
    } catch (err) {
      console.error('Error parsing message:', err);
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    const client = clients.get(clientId);
    if (client) {
      gameManager.removePlayer(client.gameId, clientId);
      clients.delete(clientId);

      const game = gameManager.getGameState(client.gameId);
      if (!game) {
        clearRoundTimer(client.gameId);
      } else if (game.status === 'waiting') {
        broadcastLobby(client.gameId);
      } else if (game.status === 'playing' && gameManager.allPlayersAnswered(client.gameId)) {
        // The player who left may have been the last one we were waiting for
        endRound(client.gameId);
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for client ${clientId}:`, err);
  });
});

function handleWebSocketMessage(clientId: string, message: any, ws: any) {
  switch (message.type) {
    case 'join':
      handleJoinGame(clientId, message, ws);
      break;
    case 'answer':
      handleAnswer(clientId, message);
      break;
    case 'update-settings':
      handleUpdateSettings(clientId, message);
      break;
    case 'ready':
      handlePlayerReady(clientId, message).catch(err => console.error('Failed to start round:', err));
      break;
    default:
      console.warn(`Unknown message type: ${message.type}`);
  }
}

function handleJoinGame(clientId: string, message: any, ws: any) {
  const gameId = message.gameId || uuidv4();
  const userId = message.userId;

  const client: GameClient = {
    id: clientId,
    gameId,
    userId,
    send: (msg: string) => ws.send(msg)
  };

  clients.set(clientId, client);

  const game = gameManager.joinGame(gameId, userId, clientId);

  ws.send(JSON.stringify({
    type: 'game-joined',
    gameId,
    clientId,
    genres: GENRES,
    gameState: {
      players: game.players,
      hostClientId: game.hostClientId,
      settings: game.settings,
      currentRound: game.currentRound,
      totalRounds: game.totalRounds
    }
  }));

  broadcastLobby(gameId);
}

function handleUpdateSettings(clientId: string, message: any) {
  const client = clients.get(clientId);
  if (!client) return;

  const settings: { genreId?: number; mode?: any } = {};
  if (message.genreId !== undefined) settings.genreId = Number(message.genreId);
  if (message.mode !== undefined) settings.mode = message.mode;

  if (gameManager.updateSettings(client.gameId, clientId, settings)) {
    broadcastLobby(client.gameId);
  }
}

function broadcastLobby(gameId: string) {
  const game = gameManager.getGameState(gameId);
  if (!game) return;
  broadcastToGame(gameId, {
    type: 'lobby-updated',
    players: game.players,
    hostClientId: game.hostClientId,
    settings: game.settings
  });
}

function handleAnswer(clientId: string, message: any) {
  const client = clients.get(clientId);
  if (!client) return;

  const result = gameManager.recordAnswer(client.gameId, clientId, String(message.answer));
  if (!result) return;

  // Only the answering player learns their result now; everyone sees the reveal at round end
  client.send(JSON.stringify({
    type: 'answer-recorded',
    correct: result.correct,
    points: result.points
  }));

  if (gameManager.allPlayersAnswered(client.gameId)) {
    endRound(client.gameId);
  }
}

async function handlePlayerReady(clientId: string, message: any) {
  const client = clients.get(clientId);
  if (!client) return;

  const game = gameManager.getGameState(client.gameId);
  if (!game || game.status !== 'waiting' || startingGames.has(client.gameId)) return;

  const allReady = gameManager.setPlayerReady(client.gameId, clientId);
  broadcastLobby(client.gameId);

  if (allReady) {
    startingGames.add(client.gameId);
    try {
      await gameManager.prepareGame(client.gameId);
      await startRound(client.gameId);
    } finally {
      startingGames.delete(client.gameId);
    }
  }
}

async function startRound(gameId: string) {
  const game = await gameManager.startNextRound(gameId);
  if (game.status === 'finished') {
    finishGame(gameId);
    return;
  }

  broadcastToGame(gameId, {
    type: 'round-started',
    round: game.currentRound,
    totalRounds: game.totalRounds,
    song: {
      audioUrl: game.currentSong?.audioUrl,
      questionType: game.currentSong?.questionType,
      options: game.currentSong?.options,
      duration: gameManager.ANSWER_TIMEOUT / 1000
    }
  });

  setRoundTimer(gameId, () => endRound(gameId), gameManager.ANSWER_TIMEOUT + ROUND_GRACE_PERIOD);
}

function endRound(gameId: string) {
  const game = gameManager.getGameState(gameId);
  const round = gameManager.endCurrentRound(gameId);
  if (!game || !round) return;

  const isLastRound = gameManager.isLastRound(gameId);

  broadcastToGame(gameId, {
    type: 'round-ended',
    round: round.roundNumber,
    correctAnswer: round.song.correctAnswer,
    artist: round.song.artist,
    title: round.song.title,
    scores: game.players.map(p => ({ userId: p.userId, clientId: p.clientId, score: p.score })),
    isLastRound,
    nextIn: NEXT_ROUND_DELAY / 1000
  });

  setRoundTimer(gameId, () => {
    if (isLastRound) {
      finishGame(gameId);
    } else {
      startRound(gameId).catch(err => console.error('Failed to start round:', err));
    }
  }, NEXT_ROUND_DELAY);
}

function finishGame(gameId: string) {
  clearRoundTimer(gameId);
  const results = gameManager.finishGame(gameId);

  broadcastToGame(gameId, {
    type: 'game-finished',
    results
  });

  db.recordGame(gameId, results.map(r => ({ userId: r.player, score: r.score })))
    .catch(err => console.error('Failed to record game:', err));
}

function broadcastToGame(gameId: string, message: any) {
  const gameClients = Array.from(clients.values()).filter(c => c.gameId === gameId);
  const payload = JSON.stringify(message);
  gameClients.forEach(client => {
    client.send(payload);
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/stats', async (req, res) => {
  const stats = await db.getStats();
  res.json(stats);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`TuneDuel backend server running on port ${PORT}`);
});
