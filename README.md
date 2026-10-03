# TuneDuel - Music Trivia Game MVP

🎵 A real-time multiplayer music trivia game built with React, Express, and WebSockets.

## Features

- **Real-time Multiplayer**: Play with other users using WebSocket technology
- **7-Song Games**: Each game features 7 different songs
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

- Node.js 22+ and npm 7+
- PostgreSQL 14+ (locally: `brew install postgresql@17`)

## Installation & Setup

```bash
npm install
createdb tuneduel
cp backend/.env.example backend/.env
```

The backend creates its tables on first start. Settings live in `backend/.env`:

- `DATABASE_URL`: Postgres connection (default `postgres://localhost/tuneduel`)
- `GOOGLE_CLIENT_ID`: enables Google sign-in (see below). Without it, a local-only dev sign-in is shown instead

### Google sign-in

1. In the [Google Cloud console](https://console.cloud.google.com), create a project (e.g. "TuneDuel")
2. Under **Google Auth Platform → Branding**, set the app name and support email; under **Audience**, choose **External** and add yourself as a test user
3. Under **Clients**, create an **OAuth client ID** of type **Web application**
4. Add **Authorized JavaScript origins**: `http://localhost:3001` and `http://localhost:8080` (plus your production URL later). No redirect URI is needed
5. Put the client ID in `backend/.env` as `GOOGLE_CLIENT_ID=...` and restart the server

Google only allows sign-in from `localhost` or HTTPS origins, so friends opening your Wi-Fi address (`http://10.0.0.x:8080`) can join as guests but can't sign in until the game is deployed with HTTPS.

## Accounts and Guests

- **Signed in** (Google): pick a unique display name once; can create games, and scores are saved
- **Guests**: join an existing game with a code or invite link; they play normally, but their scores don't count toward leaderboards

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

1. **Create**: Sign in with Google and click "Create game". You're the host 👑
2. **Invite**: Share the game code or invite link shown in the lobby
3. **Choose**: The host picks a genre and whether to guess the artist, the title, or a mix
4. **Start**: The game starts when every player clicks "Ready to Play!"
5. **Listen & answer**: Each round plays a 30-second preview; pick the right answer from 4 options
6. **Score**: Faster correct answers earn more points (up to 1000)
7. **Reveal**: The round ends when everyone answered or time runs out; the next song starts 5 seconds later
8. **Results**: After 7 songs, view the final rankings

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
- `GET /api/config` - Google client ID and whether dev sign-in is available
- `GET /api/me` - The signed-in user, or `null`
- `POST /api/auth/google` - Sign in with a Google ID token
- `POST /api/auth/dev` - Local-only test sign-in (disabled in production)
- `POST /api/auth/logout` - Sign out
- `PUT /api/me/display-name` - Set your display name

## Database Schema

Postgres, with migrations in `backend/src/database/migrations.ts` applied at startup.

- **users**: Google account and unique display name
- **sessions**: login sessions (only a hash of the cookie token is stored)
- **games**: finished games with genre, mode and song count
- **game_players**: final ranking per game; `user_id` is empty for guests
- **game_songs**: the songs played, with the answer options shown
- **answers**: every answer with points and answer time

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
