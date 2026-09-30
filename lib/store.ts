/**
 * Session store — in-memory implementation
 *
 * Interface is designed to be swapped for a Redis/database adapter
 * without touching the API routes.  The store is a Next.js-safe
 * module-level singleton (works in both dev and production where
 * the Node process stays alive between requests).
 *
 * For multiplayer: replace with a Redis adapter that uses the session
 * ID as the key and serialises the GameSession to JSON.
 */

import { GameSession } from './types';

// Module-level singleton — persists across API requests in the same process
const store = new Map<string, GameSession>();

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
