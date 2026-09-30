/**
 * POST /api/game/start
 *
 * Creates a new game session and starts round 1.
 *
 * Body: { playerId?: string }
 * Response: StartSessionResponse
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createSession,
  startCurrentRound,
  buildRoundView,
} from '../../../lib/engine';
import { sessionStore } from '../../../lib/store';
import type { StartSessionResponse } from '../../../lib/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<StartSessionResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const playerId: string = req.body?.playerId ?? 'anonymous';

  // Create session and immediately start round 1
  let session = createSession(playerId);
  session = startCurrentRound(session);
  sessionStore.set(session);

  const roundView = buildRoundView(session);
  if (!roundView) {
    return res.status(500).json({ error: 'Failed to build round view' });
  }

  return res.status(201).json({ sessionId: session.id, roundView });
}
