/**
 * POST /api/game/guess
 *
 * Submit a guess for the current round.
 *
 * Body: { sessionId: string; guess: string }
 * Response: SubmitGuessResponse
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { submitGuess, buildRoundView } from '../../../lib/engine';
import { sessionStore } from '../../../lib/store';
import type { SubmitGuessResponse } from '../../../lib/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<SubmitGuessResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId, guess } = req.body ?? {};

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId required' });
  }
  if (!guess || typeof guess !== 'string') {
    return res.status(400).json({ error: 'guess required' });
  }

  const existing = sessionStore.get(sessionId);
  if (!existing) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (existing.status !== 'in_round') {
    return res.status(409).json({ error: `Cannot guess in status: ${existing.status}` });
  }

  const updated = submitGuess(existing, guess);
  sessionStore.set(updated);

  const roundView = buildRoundView(updated);
  if (!roundView) {
    return res.status(500).json({ error: 'Failed to build round view' });
  }

  return res.status(200).json({ roundView });
}
