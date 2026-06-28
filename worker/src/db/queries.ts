import { Env, Story, User, Session } from '../types';

export async function getPublishedStories(
  db: D1Database,
  opts: { category?: string; cursor?: string; limit?: number }
): Promise<{ stories: Story[]; nextCursor: string | null }> {
  const limit = opts.limit || 20;
  const params: unknown[] = [];

  let where = "WHERE s.status = 'published'";

  if (opts.category) {
    where += ' AND s.category = ?';
    params.push(opts.category);
  }

  if (opts.cursor) {
    where += ' AND s.published_at < ?';
    params.push(opts.cursor);
  }

  const sql = `
    SELECT s.*, src.name as source_name,
      (SELECT COUNT(*) FROM engagement e WHERE e.story_id = s.id AND e.type = 'upvote') as upvote_count
    FROM story s
    LEFT JOIN source src ON s.source_id = src.id
    ${where}
    ORDER BY s.published_at DESC
    LIMIT ?
  `;
  params.push(limit + 1);

  const result = await db.prepare(sql).bind(...params).all<Story>();
  const stories = result.results || [];

  let nextCursor: string | null = null;
  if (stories.length > limit) {
    stories.pop();
    nextCursor = stories[stories.length - 1].published_at!;
  }

  return { stories, nextCursor };
}

export async function getStoryById(db: D1Database, id: string): Promise<Story | null> {
  const sql = `
    SELECT s.*, src.name as source_name,
      (SELECT COUNT(*) FROM engagement e WHERE e.story_id = s.id AND e.type = 'upvote') as upvote_count
    FROM story s
    LEFT JOIN source src ON s.source_id = src.id
    WHERE s.id = ? AND s.status = 'published'
  `;
  const result = await db.prepare(sql).bind(id).first<Story>();
  return result || null;
}

export async function createMagicLinkToken(
  db: D1Database,
  email: string,
  token: string,
  expiresAt: string
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO magic_link_token (email, token, expires_at) VALUES (?, ?, ?)'
    )
    .bind(email, token, expiresAt)
    .run();
}

export async function verifyMagicLinkToken(
  db: D1Database,
  token: string
): Promise<{ email: string } | null> {
  const row = await db
    .prepare(
      "SELECT email FROM magic_link_token WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
    )
    .bind(token)
    .first<{ email: string }>();

  if (!row) return null;

  await db
    .prepare('UPDATE magic_link_token SET used = 1 WHERE token = ?')
    .bind(token)
    .run();

  return row;
}

export async function upsertUser(db: D1Database, email: string): Promise<User> {
  const existing = await db
    .prepare('SELECT * FROM user WHERE email = ?')
    .bind(email)
    .first<User>();

  if (existing) return existing;

  const result = await db
    .prepare('INSERT INTO user (email) VALUES (?) RETURNING *')
    .bind(email)
    .first<User>();

  return result!;
}

export async function createSession(
  db: D1Database,
  userId: string,
  token: string,
  expiresAt: string
): Promise<void> {
  await db
    .prepare('INSERT INTO session (user_id, token, expires_at) VALUES (?, ?, ?)')
    .bind(userId, token, expiresAt)
    .run();
}

export async function getSessionByToken(db: D1Database, token: string): Promise<(Session & { user: User }) | null> {
  const session = await db
    .prepare("SELECT * FROM session WHERE token = ? AND expires_at > datetime('now')")
    .bind(token)
    .first<Session>();

  if (!session) return null;

  const user = await db
    .prepare('SELECT * FROM user WHERE id = ?')
    .bind(session.user_id)
    .first<User>();

  if (!user) return null;

  return { ...session, user };
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM session WHERE token = ?').bind(token).run();
}
