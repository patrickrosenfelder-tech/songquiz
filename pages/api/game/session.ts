/**
 * GET /api/game/session?id=<sessionId>
 *
 * Fetch full session state. Useful for reconnection / multiplayer sync.
 *
 * Response: GetSessionResponse
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildRoundView, buildSummary } from '../../../lib/engine';
import { sessionStore } from '../../../lib/store';
import type { GetSessionResponse } from '../../../lib/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetSessionResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = req.query.id;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'id query param required' });
  }

  const session = sessionStore.get(id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.status(200).json({
    session,
    roundView: buildRoundView(session),
    summary: buildSummary(session),
  });
}
