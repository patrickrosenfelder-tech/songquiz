import express from 'express';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { networkInterfaces } from 'os';
import { join } from 'path';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { GameManager, Player } from './game/gameManager';
import { DatabaseService } from './database/database';
import { createAuthRouter, getUserFromCookieHeader } from './auth';
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
  console.error('Database initialization failed. Is Postgres running and DATABASE_URL set?', err.message);
  process.exit(1);
});

app.use('/api', createAuthRouter(db));

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

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  // Browsers send the session cookie with the WebSocket upgrade; the account is looked up on join
  const cookieHeader = req.headers.cookie;
  console.log(`Client connected: ${clientId}`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(clientId, message, ws, cookieHeader);
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

function handleWebSocketMessage(clientId: string, message: any, ws: any, cookieHeader?: string) {
  switch (message.type) {
    case 'join':
      handleJoinGame(clientId, message, ws, cookieHeader).catch(err => {
        console.error('Join failed:', err);
        ws.send(JSON.stringify({ type: 'error', message: 'Something went wrong joining. Try again.' }));
      });
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

// Signed-in players use their display name; guests can only join an existing game by code
async function handleJoinGame(clientId: string, message: any, ws: any, cookieHeader?: string) {
  if (clients.has(clientId)) return;

  const sendError = (text: string) => ws.send(JSON.stringify({ type: 'error', message: text }));
  const account = await getUserFromCookieHeader(db, cookieHeader);
  if (clients.has(clientId)) return;

  if (account && !account.displayName) {
    sendError('Choose a display name first.');
    return;
  }
  if (!account && !message.gameId) {
    sendError('Sign in to create a game. Guests can join with a game code.');
    return;
  }

  const userId = account ? account.displayName! : String(message.userId || '').trim().slice(0, 20);
  if (!userId) {
    sendError('Enter a name.');
    return;
  }

  let gameId: string;
  if (message.gameId) {
    gameId = String(message.gameId).trim().toUpperCase();
    const existing = gameManager.getGameState(gameId);
    if (!existing) {
      sendError(`No game found with code ${gameId}. Check the code and try again.`);
      return;
    }
    if (existing.status !== 'waiting') {
      sendError('That game has already started.');
      return;
    }
    if (account && existing.players.some(p => p.accountId === account.id)) {
      sendError("You're already in this game in another tab.");
      return;
    }
    if (existing.players.some(p => p.userId.toLowerCase() === userId.toLowerCase())) {
      sendError(`The name "${userId}" is already taken in this game.`);
      return;
    }
  } else {
    gameId = gameManager.generateGameCode();
  }

  const client: GameClient = {
    id: clientId,
    gameId,
    userId,
    send: (msg: string) => ws.send(msg)
  };

  clients.set(clientId, client);

  const game = gameManager.joinGame(gameId, userId, clientId, account ? account.id : null);

  ws.send(JSON.stringify({
    type: 'game-joined',
    gameId,
    clientId,
    genres: GENRES,
    gameState: {
      players: game.players.map(publicPlayer),
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
    players: game.players.map(publicPlayer),
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
    scores: game.players.map(publicPlayer),
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

  const saved = gameManager.toSavedGame(gameId);
  if (saved) {
    db.saveGame(saved).catch(err => console.error('Failed to save game:', err));
  }
}

// What other players may see about a player; account ids stay on the server
function publicPlayer(p: Player) {
  return { userId: p.userId, clientId: p.clientId, isGuest: p.isGuest, score: p.score, ready: p.ready };
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

app.get('/api/stats', (req, res, next) => {
  db.getStats().then(stats => res.json(stats)).catch(next);
});

// Serve the built frontend so the whole game runs on one port (npm start).
// In dev the React dev server on :3001 serves it instead.
const frontendBuild = join(__dirname, '..', '..', 'frontend', 'build');
const servesFrontend = process.env.NODE_ENV === 'production' && existsSync(join(frontendBuild, 'index.html'));
if (servesFrontend) {
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => res.sendFile(join(frontendBuild, 'index.html')));
}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Request failed:', err);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
});

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net): net is NonNullable<typeof net> => !!net && net.family === 'IPv4' && !net.internal)
    .map(net => net.address);
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`TuneDuel backend server running on port ${PORT}`);
  if (servesFrontend) {
    console.log(`\n🎵 Play at http://localhost:${PORT}`);
    lanAddresses().forEach(ip => {
      // 100.64.0.0/10 is used by VPNs like Tailscale, not the local Wi-Fi
      const [a, b] = ip.split('.').map(Number);
      const label = a === 100 && b >= 64 && b <= 127 ? 'Friends on your VPN (e.g. Tailscale)' : 'Friends on the same Wi-Fi';
      console.log(`   ${label}: http://${ip}:${PORT}`);
    });
    console.log('');
  }
});
