# TuneDuel - Music Trivia Game MVP

🎵 A real-time multiplayer music trivia game built with React, Express, and WebSockets.

## Features

- **Real-time Multiplayer**: Play with other users using WebSocket technology
- **10-Song Sessions**: Each game features 10 different songs
- **Points System**: Earn points based on speed and accuracy
- **Score Tracking**: Database-backed player statistics
- **Genres & Modes**: Pick a Deezer genre and guess the artist, the title, or a mix
- **Audio Sources**: Deezer previews with an iTunes fallback

## MVP Components

1. **Backend WebSocket Server** - Express.js with ws library for real-time communication
2. **Frontend React App** - Modern UI built with React 18
3. **Game Loop** - 10-song trivia sessions with 30-second rounds
4. **Database Schema** - SQLite3 for storing games, players, and scores
5. **Audio APIs** - Deezer and Apple Music integration
6. **Game Logic** - Points calculation based on answer correctness and time spent
7. **UI Components** - GameLobby, GameScreen, GameOver
8. **Player Management** - Multi-player support with concurrent game instances

## Prerequisites

- Node.js 16+ and npm 7+
- For API features: Deezer API key (optional) or Apple Music token (optional)

## Installation & Setup

```bash
npm install
```

This installs dependencies for both backend and frontend using npm workspaces.

## Hosting a Game

```bash
npm start
```

This builds everything and serves the whole game from one port (8080). The terminal prints the addresses to share:

```
🎵 Play at http://localhost:8080
   Friends on the same Wi-Fi: http://10.0.0.241:8080
```

Create a game, then share the game code or the invite link from the lobby. On macOS, allow incoming connections for Node if the firewall asks.

## Development (hot reload)

```bash
npm run dev
```

Starts the backend (port 8080, restarts on code changes) and the React dev server (port 3001) in one terminal. Open http://localhost:3001.

## Architecture

### Backend (`/backend`)

- **WebSocket Server**: Real-time player connections and game state synchronization
- **Game Manager**: Handles game logic, rounds, and scoring
- **Audio Service**: Integrates with Deezer and Apple Music APIs
- **Database Service**: SQLite3 backend for persistence

### Frontend (`/frontend`)

- **Game Lobby**: Player join and game start
- **Game Screen**: Music trivia questions with 30-second timer
- **Game Over**: Final scores and results
- **WebSocket Client**: Real-time communication with backend

## How to Play

1. **Create**: Enter a username and leave the game code empty to create a game. You're the host 👑
2. **Invite**: Share the game code or invite link shown in the lobby
3. **Choose**: The host picks a genre and whether to guess the artist, the title, or a mix
4. **Start**: The game starts when every player clicks "Ready to Play!"
5. **Listen & answer**: Each round plays a 30-second preview; pick the right answer from 4 options
6. **Score**: Faster correct answers earn more points (up to 1000)
7. **Reveal**: The round ends when everyone answered or time runs out; the next song starts 5 seconds later
8. **Results**: After 10 songs, view the final rankings

Songs come from Deezer's genre charts, with iTunes as a fallback for audio and a built-in song list if Deezer is unreachable.

## API Endpoints

### WebSocket Messages

**Client to Server:**
- `join`: Join a game by code (`gameId`), or create one when no code is given
- `update-settings`: Host changes the genre (`genreId`) or mode (`artist`/`title`/`mix`)
- `ready`: Player is ready; the game starts when everyone is
- `answer`: Submit an answer

**Server to Client:**
- `game-joined`: Join confirmation with game code, genres and lobby state
- `lobby-updated`: Players, host and settings changed
- `error`: Join failed (unknown code, game started, name taken)
- `round-started`: New round with audio, question type and options
- `answer-recorded`: Your answer's result (sent only to you)
- `round-ended`: Correct answer and scores; next round follows after 5s
- `game-finished`: Final results

### REST Endpoints

- `GET /health` - Server health check
- `GET /api/stats` - Global game statistics

## Database Schema

### Tables

- **games**: Game sessions with timestamps
- **players**: Players and their scores per game
- **rounds**: Individual rounds with song data
- **answers**: Player answers with points earned

## Running Tests

```bash
# Backend tests
npm run test:backend

# Frontend tests
npm run test:frontend
```

## Deployment

### Docker

```bash
docker build -t songquiz .
docker run -p 8080:8080 -p 3000:3000 songquiz
```

### Environment Variables

- `PORT`: Backend server port (default: 8080)
- `NODE_ENV`: Environment (development/production)
- `DEEZER_API_KEY`: Deezer API key (optional)
- `APPLE_MUSIC_TOKEN`: Apple Music bearer token (optional)

## Project Structure

```
songquiz/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Server entry point
│   │   ├── game/
│   │   │   └── gameManager.ts  # Game logic
│   │   ├── services/
│   │   │   └── audioService.ts # Audio APIs
│   │   └── database/
│   │       └── database.ts     # SQLite service
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main app component
│   │   ├── components/       # React components
│   │   └── index.js          # React entry point
│   ├── public/
│   │   └── index.html
│   └── package.json
├── package.json              # Root workspace config
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

---

**Built with ❤️ by the TuneDuel team**
