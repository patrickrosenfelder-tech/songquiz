const http = require('http');
const config = require('./config');
const createApp = require('./app');
const createGameServer = require('./websocket/gameServer');

const app = createApp();
const server = http.createServer(app);
createGameServer(server);

server.listen(config.port, () => {
  console.log(`SongQuiz backend listening on http://localhost:${config.port}`);
  console.log(`WebSocket game server on ws://localhost:${config.port}/ws`);
});
