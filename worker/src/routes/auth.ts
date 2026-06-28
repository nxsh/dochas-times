import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { Env } from '../types';
import {
  createMagicLinkToken,
  verifyMagicLinkToken,
  upsertUser,
  createSession,
  deleteSession,
} from '../db/queries';
import { sendMagicLinkEmail } from '../services/email';

const auth = new Hono<{ Bindings: Env }>();

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

auth.post('/auth/magic-link', async (c) => {
  const body = await c.req.json<{ email: string }>();
  const email = body.email?.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return c.json({ error: 'Valid email required' }, 400);
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await createMagicLinkToken(c.env.DB, email, token, expiresAt);

  const frontendUrl = c.env.FRONTEND_URL || c.req.header('origin') || 'https://dochas-times.pages.dev';
  const magicLink = `${c.env.WORKER_URL || 'https://dochas-api.ryan-nash43.workers.dev'}/api/auth/verify?token=${token}`;

  if (c.env.RESEND_API_KEY) {
    try {
      await sendMagicLinkEmail(c.env.RESEND_API_KEY, email, magicLink);
    } catch (err) {
      console.error('Failed to send magic link email:', err);
      // Fall through — still log it as backup
    }
  }

  // Always log as backup
  console.log(`[MAGIC LINK] ${email}: ${magicLink}`);

  return c.json({ ok: true, message: 'Check your email for a sign-in link.' });
});

auth.get('/auth/verify', async (c) => {
  const token = c.req.query('token');
  const frontendUrl = c.env.FRONTEND_URL || 'https://dochas-times.pages.dev';

  if (!token) {
    return c.redirect(`${frontendUrl}/login?error=token_required`);
  }

  const result = await verifyMagicLinkToken(c.env.DB, token);

  if (!result) {
    return c.redirect(`${frontendUrl}/login?error=invalid_token`);
  }

  const user = await upsertUser(c.env.DB, result.email);
  const sessionToken = generateToken();
  const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await createSession(c.env.DB, user.id, sessionToken, sessionExpires);

  // Redirect to frontend with session token — frontend stores it
  return c.redirect(`${frontendUrl}/verify?session=${sessionToken}`);
});

auth.get('/auth/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  return c.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

auth.post('/auth/logout', async (c) => {
  // Support both Bearer token and cookie-based logout
  let sessionToken: string | undefined;
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    sessionToken = authHeader.slice(7);
  } else {
    sessionToken = getCookie(c, 'session');
  }

  if (sessionToken) {
    await deleteSession(c.env.DB, sessionToken);
    deleteCookie(c, 'session', { path: '/' });
  }
  return c.json({ ok: true });
});

export default auth;
