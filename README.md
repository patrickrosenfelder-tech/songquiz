# TuneDuel - Music Quiz Game

A multiplayer music recognition game that challenges players to identify songs by their audio previews.

## Project Structure

```
songquiz/
├── backend/          # Express.js server with WebSocket + music providers
├── frontend/         # Next.js web application with React components
├── db/               # Database migrations and schema
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development without Docker)
- PostgreSQL 15 (for local development without Docker)

### Using Docker Compose (Recommended)

```bash
docker-compose up
```

This will start:
- **PostgreSQL** on `localhost:5432`
- **Backend API** on `http://localhost:3001`
- **Frontend** on `http://localhost:3000`

### Local Development

#### Backend
```bash
cd backend
npm install
npm run dev
```

Requires PostgreSQL running on `localhost:5432` with:
- User: `songquiz`
- Password: `songquiz_dev`
- Database: `songquiz`

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend will connect to backend at `http://localhost:3001`.

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

### Music Preview
- `GET /preview?query={query}` - Get audio preview for a track

### WebSocket
- `ws://localhost:3001/game` - Real-time game room events

## Configuration

### Environment Variables

**Backend** (`.env`):
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost/songquiz
CORS_ORIGIN=http://localhost:3000
APPLE_MUSIC_TOKEN=<your-token>
DEEZER_API_KEY=<your-key>
```

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
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

- Music providers require API credentials (Apple Music token, Deezer API key)
- Session state is currently in-memory on frontend; needs DB persistence
- WebSocket handlers implemented but not fully wired to frontend UI
- Rate limiting implemented server-side but not tested under load

## License

MIT
