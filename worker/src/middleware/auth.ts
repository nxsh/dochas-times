import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionByToken } from '../db/queries';
import { Env } from '../types';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const sessionToken = getCookie(c, 'session');

  if (sessionToken) {
    const session = await getSessionByToken(c.env.DB, sessionToken);
    if (session) {
      c.set('user', session.user);
    }
  }

  await next();
}

export function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
}
