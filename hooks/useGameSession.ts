/**
 * useGameSession — React hook that drives the entire game loop
 *
 * State machine:
 *   idle → loading → in_round → submitting → round_over → (next) → in_round...
 *                                                         → finished
 */

import { useState, useCallback } from 'react';
import type {
  RoundView,
  SessionSummary,
  StartSessionResponse,
  SubmitGuessResponse,
  NextRoundResponse,
} from '../lib/types';

type GamePhase =
  | 'idle'
  | 'loading'
  | 'in_round'
  | 'submitting'
  | 'round_over'
  | 'finished'
  | 'error';

interface GameState {
  phase: GamePhase;
  sessionId: string | null;
  roundView: RoundView | null;
  summary: SessionSummary | null;
  error: string | null;
}

const INITIAL: GameState = {
  phase: 'idle',
  sessionId: null,
  roundView: null,
  summary: null,
  error: null,
};

async function apiPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export function useGameSession() {
  const [state, setState] = useState<GameState>(INITIAL);

  /** Start a new game session */
  const startGame = useCallback(async (playerId?: string) => {
    setState({ ...INITIAL, phase: 'loading' });
    try {
      const data = await apiPost<StartSessionResponse>('/api/game/start', {
        playerId: playerId ?? 'player1',
      });
      setState({
        phase: 'in_round',
        sessionId: data.sessionId,
        roundView: data.roundView,
        summary: null,
        error: null,
      });
    } catch (err) {
      setState({ ...INITIAL, phase: 'error', error: String(err) });
    }
  }, []);

  /** Submit a guess */
  const submitGuess = useCallback(
    async (guess: string) => {
      if (!state.sessionId) return;
      setState((s) => ({ ...s, phase: 'submitting' }));
      try {
        const data = await apiPost<SubmitGuessResponse>('/api/game/guess', {
          sessionId: state.sessionId,
          guess,
        });
        setState((s) => ({
          ...s,
          phase: 'round_over',
          roundView: data.roundView,
        }));
      } catch (err) {
        setState((s) => ({ ...s, phase: 'error', error: String(err) }));
      }
    },
    [state.sessionId]
  );

  /** Advance to next round (or finish) */
  const nextRound = useCallback(async () => {
    if (!state.sessionId) return;
    setState((s) => ({ ...s, phase: 'loading' }));
    try {
      const data = await apiPost<NextRoundResponse & { summary?: SessionSummary }>(
        '/api/game/next',
        { sessionId: state.sessionId }
      );
      if (data.summary || !data.roundView) {
        setState((s) => ({
          ...s,
          phase: 'finished',
          roundView: null,
          summary: data.summary ?? null,
        }));
      } else {
        setState((s) => ({
          ...s,
          phase: 'in_round',
          roundView: data.roundView,
        }));
      }
    } catch (err) {
      setState((s) => ({ ...s, phase: 'error', error: String(err) }));
    }
  }, [state.sessionId]);

  /** Reset to idle */
  const reset = useCallback(() => setState(INITIAL), []);

  return { state, startGame, submitGuess, nextRound, reset };
}
