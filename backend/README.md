# songquiz
SongQuiz - music quiz / song recognition game (working repo, product name TBD)

## Backend

Node.js/Express server with a WebSocket game layer and a provider-agnostic
audio preview service.

```
src/
  index.js                          # entry point: HTTP + WS server
  app.js                            # Express app, REST routes
  config.js                         # env-driven config
  routes/preview.js                 # REST endpoints for track search
  services/musicProviders/          # preview API abstraction + fallback routing
    MusicProvider.js                # abstract base class
    DeezerProvider.js                # primary source (Deezer public search API)
    AppleMusicProvider.js            # fallback source (iTunes Search API previews)
    MusicProviderService.js          # tries primary, falls back automatically
  websocket/
    gameServer.js                    # ws connection handling / message routing
    GameRoom.js                      # room state: players, scores, current round
```

### Running

```
cp .env.example .env
npm install
npm start        # or: npm run dev (nodemon)
npm test
```

Server listens on `PORT` (default 4000): REST on `/api/preview/*` and `/health`,
WebSocket game protocol on `/ws`.

### Audio preview routing

`MusicProviderService` is the single abstraction the rest of the app calls.
It queries the provider configured via `PRIMARY_MUSIC_PROVIDER` (`deezer` by
default) and automatically retries against the other provider if the
primary errors, times out (`MUSIC_PROVIDER_TIMEOUT_MS`), or returns no
previewable tracks — so a Deezer outage doesn't take the game down.

REST:
- `GET /api/preview/search?q=<query>` — all matching tracks
- `GET /api/preview/round?q=<query>` — one track picked for a round

### WebSocket game protocol (`/ws`)

Client → server messages (`{"type": ..., ...}`):
- `join` `{ roomId, playerName }`
- `start_round` `{ query }` — fetches a track preview and starts a 15s round
- `guess` `{ guess }`
- `leave`

Server → client messages: `joined`, `player_joined`, `player_left`,
`round_started` (`previewUrl`, `endsAt`), `guess_result`, `player_scored`,
`round_result` (reveals the answer + updated scores once the round ends),
`error`.
