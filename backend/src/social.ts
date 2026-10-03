import { Router, Request, Response, NextFunction } from 'express';
import { DatabaseService, User } from './database/database';
import { SocialRepository } from './database/social';
import { getUserFromCookieHeader } from './auth';

// Express 4 doesn't catch rejected promises from async handlers
const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

export function createSocialRouter(db: DatabaseService, social: SocialRepository): Router {
  const router = Router();

  const requireUser = async (req: Request, res: Response): Promise<User | null> => {
    const user = await getUserFromCookieHeader(db, req.headers.cookie);
    if (!user || !user.displayName) {
      res.status(401).json({ error: 'Sign in first.' });
      return null;
    }
    return user;
  };

  router.get('/users/search', wrap(async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const q = String(req.query.q || '').trim();
    res.json({ users: q.length < 2 ? [] : await social.searchUsers(q, user.id) });
  }));

  router.get('/friends', wrap(async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    res.json(await social.listFriends(user.id));
  }));

  router.post('/friends', wrap(async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const target = await social.getUser(String(req.body.userId || ''));
    if (!target || target.id === user.id) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }
    res.json({ status: await social.requestFriend(user.id, target.id) });
  }));

  router.post('/friends/:id/accept', wrap(async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const ok = await social.acceptFriend(user.id, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { ok } : { error: 'No pending request from that player.' });
  }));

  router.delete('/friends/:id', wrap(async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    await social.removeFriend(user.id, req.params.id);
    res.json({ ok: true });
  }));

  // Body: { gameId, userIds?: string[] }. Without userIds it's a shareable link challenge.
  router.post('/challenges', wrap(async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const game = await social.getOwnSoloGame(String(req.body.gameId || ''), user.id);
    if (!game) {
      res.status(404).json({ error: 'You can only challenge with your own solo games.' });
      return;
    }

    const userIds: string[] = Array.isArray(req.body.userIds) ? req.body.userIds.map(String).slice(0, 20) : [];
    if (userIds.length === 0) {
      const code = await social.createChallenge(user.id, game.id, game.score, null);
      res.json({ code });
      return;
    }

    const sent: string[] = [];
    for (const id of userIds) {
      const target = await social.getUser(id);
      if (!target || target.id === user.id) continue;
      await social.createChallenge(user.id, game.id, game.score, target.id);
      sent.push(target.displayName);
    }
    res.json({ sent });
  }));

  // Public, so guests opening a link can see who challenged them
  router.get('/challenges/:code', wrap(async (req, res) => {
    const challenge = await social.getChallenge(req.params.code);
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found. Check the link.' });
      return;
    }
    const user = await getUserFromCookieHeader(db, req.headers.cookie);
    const attempt = user ? await social.getAttempt(challenge.id, user.id) : null;
    res.json({
      code: challenge.code,
      challengerName: challenge.challengerName,
      challengerScore: challenge.challengerScore,
      genreId: challenge.genreId,
      questionMode: challenge.questionMode,
      expiresAt: challenge.expiresAt,
      expired: challenge.expiresAt.getTime() < Date.now(),
      isOwn: !!user && user.id === challenge.challengerId,
      forSomeoneElse: !!challenge.targetUserId && (!user || user.id !== challenge.targetUserId),
      yourScore: attempt ? attempt.score : null
    });
  }));

  router.get('/inbox', wrap(async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    res.json(await social.getInbox(user.id));
  }));

  router.post('/inbox/seen', wrap(async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    await social.markResultsSeen(user.id);
    res.json({ ok: true });
  }));

  return router;
}
