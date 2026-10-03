import express from 'express';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { networkInterfaces } from 'os';
import { join } from 'path';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { GameManager, Player } from './game/gameManager';
import { DatabaseService, LeaderboardEntry, User } from './database/database';
import { createAuthRouter, getUserFromCookieHeader } from './auth';
import { createSocialRouter } from './social';
import { SocialRepository } from './database/social';
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

const social = new SocialRepository(db.pool);

app.use('/api', createAuthRouter(db));
app.use('/api', createSocialRouter(db, social));

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
// How long a player has to pick the next round's genre and mode before a random pick
const PICK_TIMEOUT = 30000;

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
      } else if (game.status === 'picking') {
        // The picker left: hand the pick to the next player
        if (gameManager.reassignPickerIfGone(client.gameId)) announcePick(client.gameId);
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
    case 'pick-round':
      handlePickRound(clientId, message);
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
  if (message.challenge) {
    await joinChallenge(clientId, String(message.challenge), String(message.userId || ''), account, ws, sendError);
    return;
  }
  if (!account && !message.gameId) {
    sendError('Sign in to create a game. Guests can join with a game code.');
    return;
  }
  const solo = !message.gameId && message.solo === true;

  const userId = account ? account.displayName! : String(message.userId || '').trim().slice(0, 20);
  if (!userId) {
    sendError('Enter a name.');
    return;
  }

  let gameId: string;
  if (message.gameId) {
    gameId = String(message.gameId).trim().toUpperCase();
    const existing = gameManager.getGameState(gameId);
    // Solo and challenge games are private, so treat them like a wrong code
    if (!existing || existing.kind !== 'multiplayer') {
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

  const game = gameManager.joinGame(gameId, userId, clientId, account ? account.id : null, solo ? 'solo' : 'multiplayer');

  ws.send(JSON.stringify({
    type: 'game-joined',
    gameId,
    clientId,
    genres: GENRES,
    gameState: {
      kind: game.kind,
      players: game.players.map(publicPlayer),
      hostClientId: game.hostClientId,
      settings: game.settings,
      currentRound: game.currentRound,
      totalRounds: game.totalRounds
    }
  }));

  broadcastLobby(gameId);
}

// A private one-player game replaying the challenger's 7 songs
async function joinChallenge(
  clientId: string,
  code: string,
  guestName: string,
  account: User | null,
  ws: any,
  sendError: (text: string) => void
) {
  const challenge = await social.getChallenge(code);
  if (!challenge) {
    sendError('Challenge not found. Check the link.');
    return;
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    sendError('This challenge has expired.');
    return;
  }
  if (account && account.id === challenge.challengerId) {
    sendError("You can't take your own challenge.");
    return;
  }
  if (challenge.targetUserId && (!account || account.id !== challenge.targetUserId)) {
    sendError('This challenge was sent to someone else.');
    return;
  }
  if (account && await social.getAttempt(challenge.id, account.id)) {
    sendError("You've already taken this challenge.");
    return;
  }
  const userId = account ? account.displayName! : guestName.trim().slice(0, 20);
  if (!userId) {
    sendError('Enter a name.');
    return;
  }
  const songs = await social.getChallengeSongs(code);
  if (clients.has(clientId)) return;

  const gameId = gameManager.generateGameCode();
  clients.set(clientId, { id: clientId, gameId, userId, send: (msg: string) => ws.send(msg) });
  const game = gameManager.joinGame(gameId, userId, clientId, account ? account.id : null, 'challenge');
  gameManager.setChallenge(
    gameId,
    { id: challenge.id, code: challenge.code, challengerName: challenge.challengerName, challengerScore: challenge.challengerScore },
    songs,
    challenge.genreId,
    challenge.questionMode as any
  );

  ws.send(JSON.stringify({
    type: 'game-joined',
    gameId,
    clientId,
    genres: GENRES,
    gameState: {
      kind: game.kind,
      players: game.players.map(publicPlayer),
      hostClientId: game.hostClientId,
      settings: game.settings,
      currentRound: game.currentRound,
      totalRounds: game.totalRounds
    }
  }));
}

function handleUpdateSettings(clientId: string, message: any) {
  const client = clients.get(clientId);
  if (!client) return;

  const settings: { genreId?: number; mode?: any; roundCount?: number } = {};
  if (message.genreId !== undefined) settings.genreId = Number(message.genreId);
  if (message.mode !== undefined) settings.mode = message.mode;
  if (message.roundCount !== undefined) settings.roundCount = Number(message.roundCount);

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
    gameManager.startMatch(client.gameId);
    if (game.kind !== 'multiplayer') {
      // Solo players chose genre and mode in the lobby; challenges use the challenger's
      gameManager.beginPick(client.gameId);
      gameManager.chooseRound(client.gameId, clientId, game.settings);
      await launchRound(client.gameId);
    } else {
      startPick(client.gameId);
    }
  }
}

// Before each match round, the next player in the rotation picks genre and mode
function startPick(gameId: string) {
  const picker = gameManager.beginPick(gameId);
  if (!picker) return;
  announcePick(gameId);
}

function announcePick(gameId: string) {
  const game = gameManager.getGameState(gameId);
  const picker = game?.players.find(p => p.clientId === game.pickerClientId);
  if (!game || !picker) return;

  broadcastToGame(gameId, {
    type: 'pick-started',
    matchRound: game.matchRound,
    matchRounds: game.matchRounds,
    pickerClientId: picker.clientId,
    pickerName: picker.userId,
    settings: { genreId: game.settings.genreId, mode: game.settings.mode },
    standings: [...game.players].sort((a, b) => b.score - a.score).map(publicPlayer),
    timeLimit: PICK_TIMEOUT / 1000
  });

  setRoundTimer(gameId, () => {
    if (gameManager.autoChooseRound(gameId)) {
      launchRound(gameId).catch(err => console.error('Failed to start round:', err));
    }
  }, PICK_TIMEOUT);
}

function handlePickRound(clientId: string, message: any) {
  const client = clients.get(clientId);
  if (!client) return;
  const choice = { genreId: Number(message.genreId), mode: String(message.mode) };
  if (gameManager.chooseRound(client.gameId, clientId, choice)) {
    launchRound(client.gameId).catch(err => console.error('Failed to start round:', err));
  }
}

// Loads the chosen genre's songs and starts the round's first song
async function launchRound(gameId: string) {
  if (startingGames.has(gameId)) return;
  clearRoundTimer(gameId);
  const game = gameManager.getGameState(gameId);
  if (!game) return;

  const picker = game.players.find(p => p.clientId === game.pickerClientId);
  broadcastToGame(gameId, {
    type: 'round-picked',
    matchRound: game.matchRound,
    matchRounds: game.matchRounds,
    genreId: game.settings.genreId,
    mode: game.settings.mode,
    pickerName: game.kind === 'multiplayer' ? picker?.userId ?? null : null
  });

  startingGames.add(gameId);
  try {
    await gameManager.prepareGame(gameId);
    await startRound(gameId);
  } finally {
    startingGames.delete(gameId);
  }
}

async function startRound(gameId: string) {
  const game = await gameManager.startNextRound(gameId);
  if (!game) {
    await endMatchRound(gameId);
    return;
  }

  broadcastToGame(gameId, {
    type: 'round-started',
    round: game.currentRound,
    totalRounds: game.totalRounds,
    matchRound: game.matchRound,
    matchRounds: game.matchRounds,
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
  const isLastMatchRound = gameManager.isLastMatchRound(gameId);

  broadcastToGame(gameId, {
    type: 'round-ended',
    round: round.roundNumber,
    correctAnswer: round.song.correctAnswer,
    artist: round.song.artist,
    title: round.song.title,
    scores: game.players.map(publicPlayer),
    isLastRound,
    isLastMatchRound,
    nextIn: NEXT_ROUND_DELAY / 1000
  });

  setRoundTimer(gameId, () => {
    const next = isLastRound ? endMatchRound(gameId) : startRound(gameId);
    next.catch(err => console.error('Failed to continue game:', err));
  }, NEXT_ROUND_DELAY);
}

async function endMatchRound(gameId: string) {
  gameManager.completeMatchRound(gameId);
  if (gameManager.isLastMatchRound(gameId)) {
    await finishGame(gameId);
  } else {
    startPick(gameId);
  }
}

async function finishGame(gameId: string) {
  clearRoundTimer(gameId);
  const game = gameManager.getGameState(gameId);
  if (!game) return;
  const results = gameManager.finishGame(gameId);

  // Solo players see whether they set a personal best and where they rank
  let soloSummary = null;
  let challengeSummary = null;
  if (game.kind === 'solo') {
    const saved = game.completedRounds[0];
    const soloAccount = game.players[0]?.accountId;
    if (saved && soloAccount) {
      try {
        const { genreId, questionMode } = saved;
        const previousBest = await db.getBestSoloScore(soloAccount, questionMode, genreId);
        const savedGameId = await db.saveGame(saved);
        const [genreBoard, overallBoard] = await Promise.all([
          db.getLeaderboard(questionMode, genreId, soloAccount, 0),
          db.getLeaderboard(questionMode, null, soloAccount, 0)
        ]);
        soloSummary = {
          // Lets the player challenge others to this exact game
          gameId: savedGameId,
          genreId,
          questionMode,
          previousBest,
          personalBest: previousBest === null || saved.players[0].score > previousBest,
          genreRank: genreBoard.me?.rank ?? null,
          overallRank: overallBoard.me?.rank ?? null
        };
      } catch (err) {
        console.error('Failed to save solo game:', err);
      }
    }
  } else if (game.kind === 'challenge' && game.challenge) {
    const saved = game.completedRounds[0];
    const player = game.players[0];
    if (saved && player) {
      const yourScore = player.score;
      const { challengerName, challengerScore } = game.challenge;
      challengeSummary = {
        challengerName,
        challengerScore,
        yourScore,
        outcome: yourScore > challengerScore ? 'win' : yourScore < challengerScore ? 'lose' : 'tie'
      };
      try {
        const savedGameId = await db.saveGame(saved);
        await social.recordAttempt(game.challenge.id, player.accountId, player.userId, savedGameId, yourScore);
      } catch (err) {
        console.error('Failed to save challenge attempt:', err);
      }
    }
  } else {
    const match = gameManager.toSavedMatch(gameId);
    if (match) {
      db.saveMatch(match).catch(err => console.error('Failed to save match:', err));
    }
  }

  broadcastToGame(gameId, {
    type: 'game-finished',
    results,
    matchRounds: game.matchRounds,
    solo: soloSummary,
    challenge: challengeSummary
  });
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

app.get('/api/genres', (req, res) => {
  res.json({ genres: GENRES });
});

// ?mode=artist|title|mix&genre=<id> (omit genre for the overall board)
app.get('/api/leaderboard', (req, res, next) => {
  const mode = String(req.query.mode || 'artist');
  if (!['artist', 'title', 'mix'].includes(mode)) {
    res.status(400).json({ error: 'Unknown mode.' });
    return;
  }
  const genre = req.query.genre !== undefined && req.query.genre !== '' ? Number(req.query.genre) : null;
  if (genre !== null && !GENRES.some(g => g.id === genre)) {
    res.status(400).json({ error: 'Unknown genre.' });
    return;
  }
  (async () => {
    const user = await getUserFromCookieHeader(db, req.headers.cookie);
    const board = await db.getLeaderboard(mode, genre, user ? user.id : null);
    // Account ids stay on the server; isMe lets the page highlight your row
    const publicEntry = ({ userId, ...e }: LeaderboardEntry) => ({ ...e, isMe: !!user && userId === user.id });
    res.json({ entries: board.entries.map(publicEntry), me: board.me ? publicEntry(board.me) : null });
  })().catch(next);
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
