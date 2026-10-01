# TuneDuel - Music Quiz Game

A multiplayer music recognition game that challenges players to identify songs by their audio previews.

## Project Structure

```
songquiz/
├── package.json      # Root orchestrator: `npm install && npm run dev` runs everything
├── backend/          # Express.js server with WebSocket + music providers
├── frontend/         # Next.js web application with React components (the playable game)
├── db/               # Database migrations and schema
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+

### Run it

```bash
npm install
npm run dev
```

This installs and starts both apps together:
- **Frontend (the playable game)** on `http://localhost:4001` — self-contained: 10-round
  game loop, scoring, and a static catalog of real song preview clips. No API keys,
  database, or the backend below are required to play it.
- **Backend (audio preview API)** on `http://localhost:4000` — a separate Express/WebSocket
  service exposing Deezer/Apple Music preview search (`/api/preview/search`). Deezer works
  with no credentials; it isn't wired into the frontend game loop yet (see Known Issues).

Run them individually with `npm run dev:frontend` / `npm run dev:backend` if you only need one.

PostgreSQL and Docker Compose are optional — only needed if you want to exercise the
`db/` schema or the multi-service Docker setup described below; the MVP game loop above
doesn't touch the database.

### Using Docker Compose (optional)

```bash
docker-compose up
```

This will start:
- **PostgreSQL** on `localhost:5432`
- **Backend API** on `http://localhost:4000`
- **Frontend** on `http://localhost:4001`

## Architecture

### Backend
- **Express.js** server for REST API and WebSocket
- **Music Providers**: Apple Music and Deezer preview integration
- **Provider Service**: Fallback resolver that tries multiple sources
- **WebSocket**: Real-time game room communication
- **Tests**: Jest test suite for provider and game logic

### Frontend
- **Next.js** with React components
- **Game Engine**: 10-round session logic with scoring
- **TypeScript**: Type-safe game state and API contracts
- **Tests**: Jest test suite (23+ passing tests)
- **API Routes**: Server-side handlers for game endpoints

### Database
- **PostgreSQL** with comprehensive schema
- **Tables**: users, game_sessions, game_scores, leaderboard_stats, matchmaking_queue
- **Views**: Global rankings, session summaries, user history
- **Indexes**: Performance optimization on frequently-queried columns

## API Endpoints

### Game Management
- `POST /api/game/start` - Create and start a new game session
- `POST /api/game/session` - Get current session state
- `POST /api/game/next` - Advance to next round
- `POST /api/game/guess` - Submit an answer for current round

### Music Preview (backend, standalone — not yet called by the frontend game loop)
- `GET /api/preview/search?q={query}` - Search all providers for tracks matching a query
- `GET /api/preview/round?q={query}` - Get a single track picked for a game round
- `GET /health` - Backend health check

### WebSocket
- `ws://localhost:4000/game` - Real-time game room events

## Configuration

### Environment Variables

**Backend** (`.env`):
```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost/songquiz
CORS_ORIGIN=http://localhost:4001
APPLE_MUSIC_TOKEN=<your-token>
DEEZER_API_KEY=<your-key>
```

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

## Development Workflow

### Running Tests

**Backend**:
```bash
cd backend
npm test
```

**Frontend**:
```bash
cd frontend
npm test
```

### Database Migrations

New migrations should be added to `db/migrations/` with sequential numbering:
- `001_initial_schema.sql` - Core tables and indexes
- `002_add_feature.sql` - New features

PostgreSQL will apply migrations on container startup via the volume mount.

## Component Status

- ✅ Backend Express server with audio providers
- ✅ Frontend Next.js game with engine and components
- ✅ Database schema with all tables
- ✅ Docker Compose for local development
- ✅ End-to-end integration (core game flow)
- 🔄 Production deployment (pending)
- 🔄 Authentication/Authorization (MVP without)
- 🔄 Multiplayer matchmaking (schema ready, not implemented)
- 🔄 Leaderboard UI (schema ready, not implemented)

## Known Issues & Future Work

- Deezer preview search works with no credentials; only the Apple Music fallback
  provider requires a token (`APPLE_MUSIC_TOKEN`) — set it only if you want that
  secondary path
- The frontend game loop uses a static, hardcoded song catalog (`frontend/lib/catalog.ts`)
  rather than calling the backend's `/api/preview` endpoints — wiring the two together
  (live search instead of the static catalog) is the next integration step
- Session state is in-memory per Node process (kept alive via a `globalThis` singleton
  so it survives Next.js's per-route bundling in dev/prod); needs DB/Redis persistence
  for multi-instance deployment
- WebSocket handlers implemented but not fully wired to frontend UI
- Rate limiting implemented server-side but not tested under load

## License

MIT
