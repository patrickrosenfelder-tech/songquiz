/**
 * Session store — in-memory implementation
 *
 * Interface is designed to be swapped for a Redis/database adapter
 * without touching the API routes.
 *
 * For multiplayer: replace with a Redis adapter that uses the session
 * ID as the key and serialises the GameSession to JSON.
 */

import { GameSession } from './types';

// Next.js bundles each pages/api route as a separate webpack module graph,
// so a plain module-level `const store = new Map()` gets its own copy per
// route (session created in /api/game/start is invisible to /api/game/guess).
// Keying off globalThis guarantees one shared instance across all routes
// within the same Node process, in both dev and production.
const globalForStore = globalThis as unknown as {
  __tuneduelSessionStore?: Map<string, GameSession>;
};

const store = globalForStore.__tuneduelSessionStore ?? new Map<string, GameSession>();
globalForStore.__tuneduelSessionStore = store;

export const sessionStore = {
  /** Retrieve a session by ID (returns null if not found) */
  get(id: string): GameSession | null {
    return store.get(id) ?? null;
  },

  /** Persist a session (create or update) */
  set(session: GameSession): void {
    store.set(session.id, session);
  },

  /** Delete a session */
  delete(id: string): boolean {
    return store.delete(id);
  },

  /** List all session IDs (useful for debugging / admin) */
  listIds(): string[] {
    return [...store.keys()];
  },

  /** Current size */
  size(): number {
    return store.size;
  },
};
