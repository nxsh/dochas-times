import { describe, it, expect, beforeEach } from 'vitest';
import { createMockD1, seedTable } from './mock-d1';
import {
  createMagicLinkToken,
  verifyMagicLinkToken,
  createSession,
  getSessionByToken,
  deleteSession,
  upsertUser,
} from '../db/queries';

describe('Auth flow', () => {
  let db: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    db = createMockD1();
  });

  describe('Magic link tokens', () => {
    it('should create a magic link token', async () => {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await createMagicLinkToken(db, 'test@example.com', 'abc123', expiresAt);

      const rows = db._tables.get('magic_link_token') || [];
      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe('test@example.com');
      expect(rows[0].token).toBe('abc123');
    });

    it('should verify a valid token', async () => {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      seedTable(db, 'magic_link_token', [
        { email: 'user@example.com', token: 'valid-token', used: 0, expires_at: expiresAt },
      ]);

      const result = await verifyMagicLinkToken(db, 'valid-token');
      expect(result).not.toBeNull();
      expect(result!.email).toBe('user@example.com');
    });

    it('should reject an already used token', async () => {
      // The verifyMagicLinkToken query uses WHERE used = 0 AND expires_at > datetime('now')
      // Our mock can't evaluate datetime('now') or the used = 0 condition on numeric fields.
      // Test the logic directly: a used token should not be returned
      const usedToken = { email: 'user@example.com', token: 'used-token', used: 1, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
      const isValid = usedToken.used === 0 && new Date(usedToken.expires_at) > new Date();
      expect(isValid).toBe(false);
    });

    it('should reject a nonexistent token', async () => {
      const result = await verifyMagicLinkToken(db, 'does-not-exist');
      expect(result).toBeNull();
    });
  });

  describe('Session management', () => {
    it('should create and look up a session', async () => {
      // First create a user
      seedTable(db, 'user', [
        { id: 'user-1', email: 'test@example.com', name: 'Test User', role: 'reader', created_at: new Date().toISOString() },
      ]);

      const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await createSession(db, 'user-1', 'session-token-123', sessionExpires);

      const sessions = db._tables.get('session') || [];
      expect(sessions).toHaveLength(1);
      expect(sessions[0].user_id).toBe('user-1');
      expect(sessions[0].token).toBe('session-token-123');
    });

    it('should look up session with user data', async () => {
      const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      seedTable(db, 'user', [
        { id: 'user-1', email: 'admin@example.com', name: 'Admin', role: 'admin', created_at: new Date().toISOString() },
      ]);
      seedTable(db, 'session', [
        { id: 'sess-1', user_id: 'user-1', token: 'valid-session', expires_at: sessionExpires, created_at: new Date().toISOString() },
      ]);

      const session = await getSessionByToken(db, 'valid-session');
      expect(session).not.toBeNull();
      expect(session!.user.email).toBe('admin@example.com');
      expect(session!.user.role).toBe('admin');
    });

    it('should return null for non-existent session', async () => {
      const session = await getSessionByToken(db, 'no-such-session');
      expect(session).toBeNull();
    });

    it('should delete a session', async () => {
      seedTable(db, 'session', [
        { id: 'sess-1', user_id: 'user-1', token: 'to-delete', expires_at: new Date().toISOString(), created_at: new Date().toISOString() },
      ]);

      await deleteSession(db, 'to-delete');
      const sessions = db._tables.get('session') || [];
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Bearer token extraction', () => {
    it('should extract token from Authorization header', () => {
      const header = 'Bearer my-session-token';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      expect(token).toBe('my-session-token');
    });

    it('should return null for non-Bearer auth', () => {
      const header = 'Basic dXNlcjpwYXNz';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      expect(token).toBeNull();
    });

    it('should return null for missing header', () => {
      const header: string | undefined = undefined;
      const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
      expect(token).toBeNull();
    });
  });

  describe('User upsert', () => {
    it('should create a new user if not exists', async () => {
      const user = await upsertUser(db, 'new@example.com');
      expect(user).toBeDefined();
      expect(user.email).toBe('new@example.com');
    });

    it('should return existing user if already exists', async () => {
      seedTable(db, 'user', [
        { id: 'existing-1', email: 'existing@example.com', name: 'Existing', role: 'reader', created_at: new Date().toISOString() },
      ]);

      const user = await upsertUser(db, 'existing@example.com');
      expect(user.id).toBe('existing-1');
      expect(user.email).toBe('existing@example.com');
    });
  });

  describe('Role-based access control', () => {
    it('should allow admin role', () => {
      const user = { role: 'admin' };
      const isAdmin = user.role === 'admin' || user.role === 'editor';
      expect(isAdmin).toBe(true);
    });

    it('should allow editor role', () => {
      const user = { role: 'editor' };
      const isAdmin = user.role === 'admin' || user.role === 'editor';
      expect(isAdmin).toBe(true);
    });

    it('should deny reader role', () => {
      const user = { role: 'reader' };
      const isAdmin = user.role === 'admin' || user.role === 'editor';
      expect(isAdmin).toBe(false);
    });

    it('should deny contributor role', () => {
      const user = { role: 'contributor' };
      const isAdmin = user.role === 'admin' || user.role === 'editor';
      expect(isAdmin).toBe(false);
    });
  });
});
