import { Hono } from 'hono';
import { Env, User } from '../types';
import { fetchSingleSource } from '../cron/ingest';

const admin = new Hono<{ Bindings: Env }>();

function requireAdmin(user: User | undefined): Response | null {
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  if (user.role !== 'admin' && user.role !== 'editor') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  return null;
}

// ---- Sources ----

admin.get('/admin/sources', async (c) => {
  const denied = requireAdmin(c.get('user') as User | undefined);
  if (denied) return denied;

  const result = await c.env.DB.prepare('SELECT * FROM source ORDER BY name ASC').all();
  return c.json({ sources: result.results || [] });
});

admin.post('/admin/sources', async (c) => {
  const denied = requireAdmin(c.get('user') as User | undefined);
  if (denied) return denied;

  const body = await c.req.json<{
    name: string;
    type: string;
    url?: string;
    feed_url: string;
    terms_ok?: boolean;
  }>();

  if (!body.name || !body.feed_url) {
    return c.json({ error: 'name and feed_url are required' }, 400);
  }

  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const id = 'src-' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  await c.env.DB
    .prepare(
      `INSERT INTO source (id, name, type, url, feed_url, terms_ok, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .bind(id, body.name, body.type || 'rss', body.url || body.feed_url, body.feed_url, body.terms_ok ? 1 : 0)
    .run();

  const source = await c.env.DB.prepare('SELECT * FROM source WHERE id = ?').bind(id).first();
  return c.json({ source }, 201);
});

admin.put('/admin/sources/:id', async (c) => {
  const denied = requireAdmin(c.get('user') as User | undefined);
  if (denied) return denied;

  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    type?: string;
    url?: string;
    feed_url?: string;
    terms_ok?: boolean;
    active?: boolean;
  }>();

  const existing = await c.env.DB.prepare('SELECT * FROM source WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Source not found' }, 404);

  await c.env.DB
    .prepare(
      `UPDATE source SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        url = COALESCE(?, url),
        feed_url = COALESCE(?, feed_url),
        terms_ok = COALESCE(?, terms_ok),
        active = COALESCE(?, active)
       WHERE id = ?`
    )
    .bind(
      body.name ?? null,
      body.type ?? null,
      body.url ?? null,
      body.feed_url ?? null,
      body.terms_ok !== undefined ? (body.terms_ok ? 1 : 0) : null,
      body.active !== undefined ? (body.active ? 1 : 0) : null,
      id
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM source WHERE id = ?').bind(id).first();
  return c.json({ source: updated });
});

admin.delete('/admin/sources/:id', async (c) => {
  const denied = requireAdmin(c.get('user') as User | undefined);
  if (denied) return denied;

  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM source WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

admin.post('/admin/sources/:id/fetch', async (c) => {
  const denied = requireAdmin(c.get('user') as User | undefined);
  if (denied) return denied;

  const id = c.req.param('id');

  try {
    const result = await fetchSingleSource(c.env.DB, c.env.ANTHROPIC_API_KEY, id);
    return c.json({ ok: true, fetched: result.fetched });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fetch failed';
    return c.json({ error: message }, 500);
  }
});

// ---- Review Queue ----

admin.get('/admin/review-queue', async (c) => {
  const denied = requireAdmin(c.get('user') as User | undefined);
  if (denied) return denied;

  const result = await c.env.DB
    .prepare(
      `SELECT s.*, src.name as source_name, ai.raw_json as ai_screening
       FROM story s
       LEFT JOIN source src ON s.source_id = src.id
       LEFT JOIN ai_screening ai ON ai.story_id = s.id
       WHERE s.status IN ('ai_screened', 'in_review')
       ORDER BY s.created_at DESC
       LIMIT 100`
    )
    .all();

  return c.json({ stories: result.results || [] });
});

admin.post('/admin/stories/:id/publish', async (c) => {
  const denied = requireAdmin(c.get('user') as User | undefined);
  if (denied) return denied;

  const id = c.req.param('id');

  const story = await c.env.DB
    .prepare("SELECT * FROM story WHERE id = ? AND status IN ('ai_screened', 'in_review')")
    .bind(id)
    .first();

  if (!story) return c.json({ error: 'Story not found or not in reviewable status' }, 404);

  await c.env.DB
    .prepare(
      `UPDATE story SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    )
    .bind(id)
    .run();

  return c.json({ ok: true });
});

admin.post('/admin/stories/:id/reject', async (c) => {
  const denied = requireAdmin(c.get('user') as User | undefined);
  if (denied) return denied;

  const id = c.req.param('id');
  const body = await c.req.json<{ reason?: string }>().catch(() => ({ reason: '' }));

  const story = await c.env.DB
    .prepare("SELECT * FROM story WHERE id = ? AND status IN ('ai_screened', 'in_review', 'submitted')")
    .bind(id)
    .first();

  if (!story) return c.json({ error: 'Story not found or not in rejectable status' }, 404);

  await c.env.DB
    .prepare(
      `UPDATE story SET status = 'rejected', rejection_reason = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(body.reason || null, id)
    .run();

  return c.json({ ok: true });
});

export default admin;
