import { fetchFeed, FeedEntry } from '../services/rss';
import { screenStory, ScreeningResult } from '../services/llm';

interface Source {
  id: string;
  name: string;
  type: string;
  url: string;
  feed_url: string;
  active: number;
}

interface PendingStory {
  id: string;
  title: string;
  snippet: string | null;
  body: string | null;
  origin: string;
  source_id: string | null;
  source_name?: string;
}

function generateId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchAndStoreFeed(db: D1Database, source: Source): Promise<number> {
  let entries: FeedEntry[];
  try {
    entries = await fetchFeed(source.feed_url);
  } catch (err) {
    console.error(`Failed to fetch feed ${source.name}:`, err);
    return 0;
  }

  if (entries.length === 0) return 0;

  // Get existing guids for this source to dedup — batch to avoid SQLite variable limit
  const existingGuids = new Set<string>();
  const guids = entries.map((e) => e.guid);
  const batchSize = 20;
  for (let i = 0; i < guids.length; i += batchSize) {
    const batch = guids.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(',');
    const existing = await db
      .prepare(`SELECT external_guid FROM story WHERE source_id = ? AND external_guid IN (${placeholders})`)
      .bind(source.id, ...batch)
      .all<{ external_guid: string }>();
    for (const r of existing.results || []) {
      existingGuids.add(r.external_guid);
    }
  }

  let inserted = 0;
  for (const entry of entries) {
    if (existingGuids.has(entry.guid)) continue;

    const id = generateId();
    const snippet = entry.description.slice(0, 280);

    await db
      .prepare(
        `INSERT INTO story (id, origin, source_id, title, snippet, external_url, external_guid, status, created_at, updated_at)
         VALUES (?, 'aggregated', ?, ?, ?, ?, ?, 'submitted', datetime('now'), datetime('now'))`
      )
      .bind(id, source.id, entry.title, snippet, entry.link, entry.guid)
      .run();

    inserted++;
  }

  // Update source last_fetched
  await db
    .prepare(`UPDATE source SET last_fetched_at = datetime('now') WHERE id = ?`)
    .bind(source.id)
    .run();

  return inserted;
}

async function screenPendingStories(db: D1Database, apiKey: string): Promise<void> {
  const pending = await db
    .prepare(
      `SELECT s.id, s.title, s.snippet, s.body, s.origin, s.source_id, src.name as source_name
       FROM story s
       LEFT JOIN source src ON s.source_id = src.id
       WHERE s.status = 'submitted' AND s.origin = 'aggregated'
       ORDER BY s.created_at ASC
       LIMIT 20`
    )
    .all<PendingStory>();

  const stories = pending.results || [];
  if (stories.length === 0) return;

  // Process in batches of 5
  for (let i = 0; i < stories.length; i += 5) {
    const batch = stories.slice(i, i + 5);

    const results = await Promise.allSettled(
      batch.map(async (story) => {
        const result = await screenStory(
          apiKey,
          story.title,
          story.snippet || '',
          story.source_name || 'Unknown',
          story.origin as 'aggregated' | 'submission',
          story.body || undefined
        );
        return { story, result };
      })
    );

    for (const settled of results) {
      if (settled.status === 'rejected') {
        console.error('Screening failed:', settled.reason);
        continue;
      }

      const { story, result } = settled.value;
      await applyScreeningResult(db, story.id, result);
    }
  }
}

async function applyScreeningResult(
  db: D1Database,
  storyId: string,
  result: ScreeningResult
): Promise<void> {
  const flagsJson = JSON.stringify(result.flags);
  const screeningJson = JSON.stringify(result);

  // Auto-publish if high valence, no flags, no human check needed
  const autoPublish =
    result.valence_score >= 6 &&
    result.is_positive &&
    result.flags.length === 1 &&
    result.flags[0] === 'none' &&
    !result.needs_human_check;

  const newStatus = autoPublish ? 'published' : 'ai_screened';

  // Store screening result in ai_screening table
  const screeningId = generateId();
  await db
    .prepare(
      `INSERT INTO ai_screening (id, story_id, raw_json, model_version)
       VALUES (?, ?, ?, 'claude-haiku-4-5-20251001')`
    )
    .bind(screeningId, storyId, screeningJson)
    .run();

  // Update story with scores and status
  await db
    .prepare(
      `UPDATE story
       SET status = ?,
           category = ?,
           valence_score = ?,
           flags = ?,
           title = CASE WHEN ? != '' THEN ? ELSE title END,
           published_at = ${autoPublish ? "datetime('now')" : 'NULL'},
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      newStatus,
      result.category,
      result.valence_score,
      flagsJson,
      result.suggested_headline,
      result.suggested_headline,
      storyId
    )
    .run();
}

export async function runIngestion(db: D1Database, apiKey: string): Promise<{ fetched: number; screened: boolean }> {
  // Step 1: Fetch active sources
  const sources = await db
    .prepare('SELECT * FROM source WHERE active = 1')
    .all<Source>();

  const activeSources = sources.results || [];
  console.log(`[ingest] Found ${activeSources.length} active sources`);

  // Step 2: Fetch feeds and store new entries
  let totalInserted = 0;
  for (const source of activeSources) {
    const count = await fetchAndStoreFeed(db, source);
    console.log(`[ingest] ${source.name}: ${count} new entries`);
    totalInserted += count;
  }

  // Step 3: Screen pending stories
  await screenPendingStories(db, apiKey);

  return { fetched: totalInserted, screened: true };
}

export async function fetchSingleSource(db: D1Database, apiKey: string, sourceId: string): Promise<{ fetched: number }> {
  const source = await db
    .prepare('SELECT * FROM source WHERE id = ?')
    .bind(sourceId)
    .first<Source>();

  if (!source) throw new Error('Source not found');

  const count = await fetchAndStoreFeed(db, source);

  // Screen any new stories from this source
  await screenPendingStories(db, apiKey);

  return { fetched: count };
}
