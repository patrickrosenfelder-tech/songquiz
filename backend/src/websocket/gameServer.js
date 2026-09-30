const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const GameRoom = require('./GameRoom');
const musicProviderService = require('../services/musicProviders');

/**
 * Attaches a WebSocket game server to an existing HTTP server. Rooms are
 * kept in-process; each connection is tagged with the room/player it
 * belongs to so a disconnect can clean up the right room.
 */
function createGameServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const rooms = new Map(); // roomId -> GameRoom

  function getOrCreateRoom(roomId) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new GameRoom(roomId));
    }
    return rooms.get(roomId);
  }

  function send(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function handleRoundEnd(room, endedRound) {
    if (!endedRound) return;
    room.broadcast({
      type: 'round_result',
      roundNumber: endedRound.roundNumber,
      correctAnswer: { title: endedRound.track.title, artist: endedRound.track.artist },
      correctPlayerIds: endedRound.correctPlayerIds,
      state: room.publicState(),
    });
  }

  wss.on('connection', (ws) => {
    ws.playerId = crypto.randomUUID();
    ws.roomId = null;

    ws.on('message', async (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return send(ws, { type: 'error', message: 'invalid JSON message' });
      }

      const { type } = message;

      if (type === 'join') {
        const { roomId, playerName } = message;
        if (!roomId || !playerName) {
          return send(ws, { type: 'error', message: 'roomId and playerName are required' });
        }
        ws.roomId = roomId;
        const room = getOrCreateRoom(roomId);
        room.addPlayer(ws.playerId, ws, playerName);

        send(ws, { type: 'joined', playerId: ws.playerId, state: room.publicState() });
        room.broadcast(
          { type: 'player_joined', playerId: ws.playerId, playerName, state: room.publicState() },
          ws.playerId
        );
        return;
      }

      const room = ws.roomId && rooms.get(ws.roomId);
      if (!room) {
        return send(ws, { type: 'error', message: 'join a room before sending other messages' });
      }

      if (type === 'start_round') {
        const query = message.query || 'top hits';
        try {
          const track = await musicProviderService.getRoundTrack(query);
          const round = room.startRound(track, (endedRound) => handleRoundEnd(room, endedRound));
          room.broadcast({
            type: 'round_started',
            roundNumber: round.roundNumber,
            previewUrl: round.track.previewUrl,
            endsAt: round.endsAt,
            source: track.resolvedSource,
            degraded: track.degraded,
          });
        } catch (err) {
          send(ws, { type: 'error', message: `could not start round: ${err.message}` });
        }
        return;
      }

      if (type === 'guess') {
        const result = room.submitGuess(ws.playerId, message.guess || '');
        send(ws, { type: 'guess_result', result });
        if (result === 'correct') {
          room.broadcast(
            { type: 'player_scored', playerId: ws.playerId, state: room.publicState() },
            ws.playerId
          );
        }
        return;
      }

      if (type === 'leave') {
        room.removePlayer(ws.playerId);
        room.broadcast({ type: 'player_left', playerId: ws.playerId, state: room.publicState() });
        ws.roomId = null;
        return;
      }

      send(ws, { type: 'error', message: `unknown message type "${type}"` });
    });

    ws.on('close', () => {
      if (!ws.roomId) return;
      const room = rooms.get(ws.roomId);
      if (!room) return;
      room.removePlayer(ws.playerId);
      room.broadcast({ type: 'player_left', playerId: ws.playerId, state: room.publicState() });
      if (room.isEmpty) {
        rooms.delete(ws.roomId);
      }
    });
  });

  return wss;
}

module.exports = createGameServer;
