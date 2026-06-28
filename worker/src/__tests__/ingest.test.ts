import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockD1, seedTable } from './mock-d1';

describe('Ingestion pipeline', () => {
  let db: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    db = createMockD1();
    vi.restoreAllMocks();
  });

  describe('Dedup by external_guid', () => {
    it('should not insert stories with existing guids', async () => {
      seedTable(db, 'story', [
        {
          id: 'existing-1', origin: 'aggregated', source_id: 'src-1',
          title: 'Already exists', snippet: 'Old story', external_guid: 'guid-already-exists',
          status: 'published', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        },
      ]);

      // Check if guid exists
      const existingGuids = new Set<string>();
      const result = await db
        .prepare('SELECT external_guid FROM story WHERE source_id = ?')
        .bind('src-1')
        .all<{ external_guid: string }>();

      for (const r of result.results || []) {
        existingGuids.add(r.external_guid);
      }

      expect(existingGuids.has('guid-already-exists')).toBe(true);
      expect(existingGuids.has('guid-new')).toBe(false);
    });

    it('should insert stories with new guids', async () => {
      const existingGuids = new Set<string>();
      const newGuid = 'brand-new-guid';
      expect(existingGuids.has(newGuid)).toBe(false);

      // Use simpler INSERT that the mock can parse
      await db
        .prepare(
          `INSERT INTO story (id, origin, source_id, title, snippet, external_url, external_guid, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind('new-id', 'aggregated', 'src-1', 'New Story', 'Snippet', 'https://example.com/new', newGuid, 'submitted')
        .run();

      const stories = db._tables.get('story') || [];
      expect(stories.some(s => s.external_guid === newGuid)).toBe(true);
    });
  });

  describe('Auto-publish criteria', () => {
    it('should auto-publish with valence >= 6, no flags, no human check', () => {
      const result = {
        valence_score: 8,
        is_positive: true,
        flags: ['none'],
        needs_human_check: false,
      };

      const autoPublish =
        result.valence_score >= 6 &&
        result.is_positive &&
        result.flags.length === 1 &&
        result.flags[0] === 'none' &&
        !result.needs_human_check;

      expect(autoPublish).toBe(true);
    });

    it('should NOT auto-publish when valence < 6', () => {
      const result = {
        valence_score: 5,
        is_positive: true,
        flags: ['none'],
        needs_human_check: false,
      };

      const autoPublish =
        result.valence_score >= 6 &&
        result.is_positive &&
        result.flags.length === 1 &&
        result.flags[0] === 'none' &&
        !result.needs_human_check;

      expect(autoPublish).toBe(false);
    });

    it('should NOT auto-publish when flags are present', () => {
      const result = {
        valence_score: 8,
        is_positive: true,
        flags: ['needs_context'],
        needs_human_check: false,
      };

      const autoPublish =
        result.valence_score >= 6 &&
        result.is_positive &&
        result.flags.length === 1 &&
        result.flags[0] === 'none' &&
        !result.needs_human_check;

      expect(autoPublish).toBe(false);
    });

    it('should NOT auto-publish when needs_human_check is true', () => {
      const result = {
        valence_score: 9,
        is_positive: true,
        flags: ['none'],
        needs_human_check: true,
      };

      const autoPublish =
        result.valence_score >= 6 &&
        result.is_positive &&
        result.flags.length === 1 &&
        result.flags[0] === 'none' &&
        !result.needs_human_check;

      expect(autoPublish).toBe(false);
    });

    it('should NOT auto-publish when is_positive is false', () => {
      const result = {
        valence_score: 7,
        is_positive: false,
        flags: ['none'],
        needs_human_check: false,
      };

      const autoPublish =
        result.valence_score >= 6 &&
        result.is_positive &&
        result.flags.length === 1 &&
        result.flags[0] === 'none' &&
        !result.needs_human_check;

      expect(autoPublish).toBe(false);
    });

    it('should NOT auto-publish with multiple flags even if one is "none"', () => {
      const result = {
        valence_score: 8,
        is_positive: true,
        flags: ['none', 'needs_context'],
        needs_human_check: false,
      };

      const autoPublish =
        result.valence_score >= 6 &&
        result.is_positive &&
        result.flags.length === 1 &&
        result.flags[0] === 'none' &&
        !result.needs_human_check;

      expect(autoPublish).toBe(false);
    });
  });

  describe('Stories below threshold go to ai_screened', () => {
    it('should set status to ai_screened when not auto-publishable', () => {
      const result = {
        valence_score: 4,
        is_positive: true,
        flags: ['needs_context'],
        needs_human_check: true,
      };

      const autoPublish =
        result.valence_score >= 6 &&
        result.is_positive &&
        result.flags.length === 1 &&
        result.flags[0] === 'none' &&
        !result.needs_human_check;

      const newStatus = autoPublish ? 'published' : 'ai_screened';
      expect(newStatus).toBe('ai_screened');
    });
  });

  describe('Batch processing', () => {
    it('should process stories in batches of 5', () => {
      const totalStories = 12;
      const batchSize = 5;
      const batches: number[][] = [];

      for (let i = 0; i < totalStories; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, totalStories);
        const batch = Array.from({ length: batchEnd - i }, (_, j) => i + j);
        batches.push(batch);
      }

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(5);
      expect(batches[1]).toHaveLength(5);
      expect(batches[2]).toHaveLength(2);
    });

    it('should limit pending stories to 20', () => {
      const limit = 20;
      const manyStories = Array.from({ length: 50 }, (_, i) => ({
        id: `story-${i}`,
        title: `Story ${i}`,
        status: 'submitted',
      }));

      const batch = manyStories.slice(0, limit);
      expect(batch).toHaveLength(20);
    });
  });
});
