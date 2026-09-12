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

// Only ingest feed entries published within this window. Feeds routinely carry
// months of history, and a story nobody screened within MAX_QUEUE_AGE_DAYS is
// too stale to publish anyway — filtering here stops the queue growing at source.
const MAX_ENTRY_AGE_DAYS = 7;

// Anything still unscreened after this long gets expired by sweepStaleQueue().
const MAX_QUEUE_AGE_DAYS = 14;

// Screened stories awaiting human review expire too. Without this the review
// queue is the same unbounded bucket one stage later: it reached 4,960 items
// against 425 ever published, because nothing drained it and nothing aged out.
// Longer than the unscreened window — these have passed the rubric and deserve
// a real chance at review before being dropped.
const MAX_REVIEW_AGE_DAYS = 30;

// Stories screened per run. Must comfortably exceed the daily arrival rate or
// the queue grows without bound. Each one is an LLM call, so raising this costs
// money and subrequests, not D1 reads.
const SCREEN_BATCH_SIZE = 60;

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

  // Drop anything older than the ingest window before it can reach the queue.
  // normaliseDate() falls back to now() for missing/unparseable dates, so entries
  // without a usable pubDate are kept rather than silently dropped.
  const cutoff = Date.now() - MAX_ENTRY_AGE_DAYS * 86400 * 1000;
  entries = entries.filter((e) => {
    const t = Date.parse(e.pubDate);
    return isNaN(t) || t >= cutoff;
  });

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

interface ScreenOutcome {
  attempted: number;
  screened: number;
  failed: number;
}

async function screenPendingStories(db: D1Database, apiKey: string): Promise<ScreenOutcome> {
  const pending = await db
    .prepare(
      `SELECT s.id, s.title, s.snippet, s.body, s.origin, s.source_id, src.name as source_name
       FROM story s
       LEFT JOIN source src ON s.source_id = src.id
       WHERE s.status = 'submitted' AND s.origin = 'aggregated'
       ORDER BY s.created_at DESC
       LIMIT ?`
    )
    .bind(SCREEN_BATCH_SIZE)
    .all<PendingStory>();

  const stories = pending.results || [];
  if (stories.length === 0) return { attempted: 0, screened: 0, failed: 0 };

  let screened = 0;
  const failures: string[] = [];

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
        failures.push(String(settled.reason));
        continue;
      }

      const { story, result } = settled.value;
      await applyScreeningResult(db, story.id, result);
      screened++;
    }

    // Every call failing means the problem is upstream of any single story —
    // an expired key, exhausted credits, a model rename. Screening silently
    // returned zero results for two months this way (Jul-Sep 2026) because each
    // failure was logged individually and nothing summarised the run. Stop early
    // and say so loudly rather than burning the rest of the batch on the same error.
    if (screened === 0 && failures.length >= 5) {
      console.error(
        `[ingest] ABORTING: first ${failures.length} screening calls all failed. ` +
        `This is not a per-story problem. First error: ${failures[0]}`
      );
      break;
    }
  }

  if (failures.length > 0) {
    console.error(
      `[ingest] screening: ${screened} ok, ${failures.length} failed of ${stories.length} attempted`
    );
  }

  return { attempted: stories.length, screened, failed: failures.length };
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

// Expire anything that has sat unscreened past the queue window. Without this the
// 'submitted' queue is unbounded: screening drains SCREEN_BATCH_SIZE per run while
// every run adds more, and whatever falls behind stays forever.
// Rows are marked rejected, never deleted — dedup matches on external_guid, so
// deleting them would make the next fetch re-insert every one.
async function sweepStaleQueue(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE story
       SET status = 'rejected',
           rejection_reason = 'expired_unscreened',
           updated_at = datetime('now')
       WHERE status = 'submitted'
         AND origin = 'aggregated'
         AND created_at < datetime('now', ?)`
    )
    .bind(`-${MAX_QUEUE_AGE_DAYS} days`)
    .run();

  return result.meta?.changes ?? 0;
}

// The review queue needs the same treatment, but not indiscriminately.
//
// It reached 4,960 items, and 3,650 of those scored 2 or below — they were only
// in the queue because they are not auto-publishable, not because anyone wanted
// to read them. Those are what makes the queue unbounded, and they expire.
//
// A story that scored REVIEW_KEEP_SCORE or above passed the rubric and is a real
// editorial candidate; ageing it out silently would throw away the only content
// worth reviewing. Those stay until a human decides, by design.
//
// Human submissions never expire — a submission is someone's own story.
const REVIEW_KEEP_SCORE = 6;

async function sweepStaleReviewQueue(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE story
       SET status = 'rejected',
           rejection_reason = 'expired_unreviewed',
           updated_at = datetime('now')
       WHERE status = 'ai_screened'
         AND origin = 'aggregated'
         AND created_at < datetime('now', ?)
         AND (valence_score IS NULL OR valence_score < ?)`
    )
    .bind(`-${MAX_REVIEW_AGE_DAYS} days`, REVIEW_KEEP_SCORE)
    .run();

  return result.meta?.changes ?? 0;
}

export async function runIngestion(db: D1Database, apiKey: string): Promise<{ fetched: number; screened: number; screenFailures: number }> {
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

  // Step 3: Screen pending stories — newest first, so fresh news gets published
  // while stale entries age out via the sweep below rather than blocking the queue.
  const outcome = await screenPendingStories(db, apiKey);
  console.log(
    `[ingest] screened ${outcome.screened}/${outcome.attempted}` +
    (outcome.failed ? ` (${outcome.failed} FAILED)` : '')
  );

  // Step 4: Expire whatever aged out of either queue window
  const expired = await sweepStaleQueue(db);
  if (expired > 0) console.log(`[ingest] Expired ${expired} unscreened stories`);

  const unreviewed = await sweepStaleReviewQueue(db);
  if (unreviewed > 0) console.log(`[ingest] Expired ${unreviewed} unreviewed stories`);

  return { fetched: totalInserted, screened: outcome.screened, screenFailures: outcome.failed };
}

export async function fetchSingleSource(db: D1Database, apiKey: string, sourceId: string): Promise<{ fetched: number; screened: number; screenFailures: number }> {
  const source = await db
    .prepare('SELECT * FROM source WHERE id = ?')
    .bind(sourceId)
    .first<Source>();

  if (!source) throw new Error('Source not found');

  const count = await fetchAndStoreFeed(db, source);

  // Screen any new stories from this source
  const outcome = await screenPendingStories(db, apiKey);

  return { fetched: count, screened: outcome.screened, screenFailures: outcome.failed };
}
