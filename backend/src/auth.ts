import { Router, Request, Response, NextFunction } from 'express';
import { parse as parseCookies, serialize as serializeCookie } from 'cookie';
import { OAuth2Client } from 'google-auth-library';
import { DatabaseService, DisplayNameTakenError, User } from './database/database';
import { wifiAddress } from './network';

const SESSION_COOKIE = 'tuneduel_session';
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N}_.\- ]{3,20}$/u;

const isProduction = () => process.env.NODE_ENV === 'production';

// Express 4 doesn't catch rejected promises from async handlers
const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

export function publicUser(user: User) {
  return { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl };
}

export async function getUserFromCookieHeader(db: DatabaseService, cookieHeader?: string): Promise<User | null> {
  const token = parseCookies(cookieHeader || '')[SESSION_COOKIE];
  if (!token) return null;
  try {
    return await db.getUserBySession(token);
  } catch (err) {
    console.error('Session lookup failed:', err);
    return null;
  }
}

export function createAuthRouter(db: DatabaseService): Router {
  const router = Router();
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  const googleClient = new OAuth2Client(googleClientId);

  const startSession = async (res: Response, user: User) => {
    const { token, expiresAt } = await db.createSession(user.id);
    res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      path: '/',
      expires: expiresAt
    }));
  };

  const requireUser = async (req: Request, res: Response): Promise<User | null> => {
    const user = await getUserFromCookieHeader(db, req.headers.cookie);
    if (!user) res.status(401).json({ error: 'Sign in first.' });
    return user;
  };

  // The frontend reads this at startup instead of baking the client ID into the build
  router.get('/config', (req, res) => {
    res.json({
      googleClientId: googleClientId || null,
      devLogin: !isProduction(),
      // Base for invite and challenge links; PUBLIC_URL wins once the game has a real domain
      publicUrl: process.env.PUBLIC_URL || null,
      wifiAddress: wifiAddress()
    });
  });

  router.get('/me', wrap(async (req, res) => {
    const user = await getUserFromCookieHeader(db, req.headers.cookie);
    res.json({ user: user ? publicUser(user) : null });
  }));

  router.post('/auth/google', wrap(async (req, res) => {
    if (!googleClientId) {
      res.status(503).json({ error: 'Google sign-in isn\'t configured on this server.' });
      return;
    }
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: String(req.body.credential || ''), audience: googleClientId });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('No subject in Google token');

      const user = await db.findOrCreateGoogleUser({ sub: payload.sub, email: payload.email, picture: payload.picture });
      await startSession(res, user);
      res.json({ user: publicUser(user) });
    } catch (err) {
      console.error('Google sign-in failed:', err instanceof Error ? err.message : err);
      res.status(401).json({ error: 'Google sign-in failed. Try again.' });
    }
  }));

  // Local testing without Google credentials; never available in production
  router.post('/auth/dev', wrap(async (req, res) => {
    if (isProduction()) {
      res.status(404).end();
      return;
    }
    const name = String(req.body.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Enter a name.' });
      return;
    }
    const user = await db.findOrCreateGoogleUser({ sub: `dev:${name.toLowerCase()}` });
    await startSession(res, user);
    res.json({ user: publicUser(user) });
  }));

  router.post('/auth/logout', wrap(async (req, res) => {
    const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
    if (token) await db.deleteSession(token);
    res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, '', { path: '/', expires: new Date(0) }));
    res.json({ ok: true });
  }));

  router.put('/me/display-name', wrap(async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const displayName = String(req.body.displayName || '').trim().replace(/\s+/g, ' ');
    if (!DISPLAY_NAME_PATTERN.test(displayName)) {
      res.status(400).json({ error: 'Use 3–20 letters, numbers, spaces, dots, dashes or underscores.' });
      return;
    }
    try {
      const updated = await db.setDisplayName(user.id, displayName);
      res.json({ user: publicUser(updated) });
    } catch (err) {
      if (err instanceof DisplayNameTakenError) {
        res.status(409).json({ error: `"${displayName}" is already taken. Try another.` });
        return;
      }
      throw err;
    }
  }));

  return router;
}
