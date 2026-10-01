import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { GameManager } from './game/gameManager';
import { DatabaseService } from './database/database';

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
    case 'ready':
      handlePlayerReady(clientId, message);
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
    gameState: {
      players: game.players,
      currentRound: game.currentRound,
      totalRounds: game.totalRounds
    }
  }));

  broadcastToGame(gameId, {
    type: 'player-joined',
    userId,
    totalPlayers: game.players.length
  });
}

function handleAnswer(clientId: string, message: any) {
  const client = clients.get(clientId);
  if (!client) return;

  const result = gameManager.recordAnswer(
    client.gameId,
    clientId,
    message.answer,
    message.timeSpent
  );

  broadcastToGame(client.gameId, {
    type: 'answer-recorded',
    userId: client.userId,
    correct: result.correct,
    points: result.points
  });
}

function handlePlayerReady(clientId: string, message: any) {
  const client = clients.get(clientId);
  if (!client) return;

  const allReady = gameManager.setPlayerReady(client.gameId, clientId);

  if (allReady) {
    const nextRound = gameManager.startNextRound(client.gameId);
    broadcastToGame(client.gameId, {
      type: 'round-started',
      round: nextRound.currentRound,
      song: {
        artist: nextRound.currentSong?.artist,
        audioUrl: nextRound.currentSong?.audioUrl,
        options: nextRound.currentSong?.options,
        duration: 30
      }
    });
  }
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
