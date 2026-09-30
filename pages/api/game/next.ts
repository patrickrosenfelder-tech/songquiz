/**
 * POST /api/game/next
 *
 * Advance to the next round after seeing the result.
 *
 * Body: { sessionId: string }
 * Response: NextRoundResponse  (roundView is null when game is finished)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  advanceRound,
  buildRoundView,
  buildSummary,
} from '../../../lib/engine';
import { sessionStore } from '../../../lib/store';
import type { NextRoundResponse } from '../../../lib/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<NextRoundResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.body ?? {};

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId required' });
  }

  const existing = sessionStore.get(sessionId);
  if (!existing) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (existing.status !== 'round_over') {
    return res.status(409).json({ error: `Cannot advance in status: ${existing.status}` });
  }

  const updated = advanceRound(existing);
  sessionStore.set(updated);

  if (updated.status === 'finished') {
    // Return summary alongside a null roundView to signal game over
    const summary = buildSummary(updated);
    return res.status(200).json({ roundView: null as unknown as ReturnType<typeof buildRoundView> & NonNullable<unknown>, summary } as unknown as NextRoundResponse);
  }

  const roundView = buildRoundView(updated);
  if (!roundView) {
    return res.status(500).json({ error: 'Failed to build round view' });
  }

  return res.status(200).json({ roundView });
}
