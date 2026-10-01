# TuneDuel - Music Trivia Game MVP

🎵 A real-time multiplayer music trivia game built with React, Express, and WebSockets.

## Features

- **Real-time Multiplayer**: Play with other users using WebSocket technology
- **10-Song Sessions**: Each game features 10 different songs
- **Artist Identification**: Guess the artist behind each song
- **Points System**: Earn points based on speed and accuracy
- **Score Tracking**: Database-backed player statistics
- **Multiple Audio APIs**: Supports Deezer and Apple Music (with fallback)

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

### 1. Install Dependencies

```bash
npm install
```

This will install dependencies for both backend and frontend using npm workspaces.

### 2. Build the Project

```bash
npm run build
```

### 3. Start the Development Servers

```bash
npm start
```

This launches both the backend server (port 8080) and frontend app (port 3000) concurrently.

### Development Mode (with hot reload)

```bash
npm run dev
```

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

1. **Join**: Enter your username and click "Join Game"
2. **Wait**: Other players can join the same game lobby
3. **Start**: Click "Ready to Play!" to begin
4. **Listen**: A 30-second audio preview plays each round
5. **Answer**: Select the correct artist from 4 options
6. **Score**: Earn points for correct answers (bonus for speed)
7. **Repeat**: Play through 10 rounds total
8. **Results**: View final scores and rankings

## API Endpoints

### WebSocket Messages

**Client to Server:**
- `join`: Join a game
- `answer`: Submit an answer
- `ready`: Signal player is ready for next round

**Server to Client:**
- `game-joined`: Confirmation of game join
- `round-started`: New round with song data
- `answer-recorded`: Feedback on submitted answer
- `player-joined`: Notification of new player
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
