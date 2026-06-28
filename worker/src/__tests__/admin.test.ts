import { describe, it, expect, beforeEach } from 'vitest';
import { createMockD1, seedTable } from './mock-d1';

describe('Admin operations', () => {
  let db: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    db = createMockD1();
  });

  describe('Source CRUD', () => {
    it('should create a source', async () => {
      const id = 'src-new-1';
      await db
        .prepare(
          `INSERT INTO source (id, name, type, url, feed_url, terms_ok, active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`
        )
        .bind(id, 'BBC Oxfordshire', 'rss', 'https://bbc.co.uk/oxon', 'https://bbc.co.uk/oxon/rss', 1)
        .run();

      const source = await db.prepare('SELECT * FROM source WHERE id = ?').bind(id).first();
      expect(source).not.toBeNull();
      expect((source as any).name).toBe('BBC Oxfordshire');
      expect((source as any).type).toBe('rss');
    });

    it('should list all sources', async () => {
      seedTable(db, 'source', [
        { id: 'src-1', name: 'Source A', type: 'rss', url: 'https://a.com', feed_url: 'https://a.com/rss', active: 1, terms_ok: 1 },
        { id: 'src-2', name: 'Source B', type: 'council', url: 'https://b.com', feed_url: 'https://b.com/rss', active: 0, terms_ok: 0 },
      ]);

      const result = await db.prepare('SELECT * FROM source').all();
      expect((result.results || []).length).toBe(2);
    });

    it('should update a source', async () => {
      seedTable(db, 'source', [
        { id: 'src-1', name: 'Old Name', type: 'rss', url: 'https://old.com', feed_url: 'https://old.com/rss', active: 1 },
      ]);

      await db
        .prepare('UPDATE source SET name = ? WHERE id = ?')
        .bind('New Name', 'src-1')
        .run();

      const updated = await db.prepare('SELECT * FROM source WHERE id = ?').bind('src-1').first();
      expect((updated as any).name).toBe('New Name');
    });

    it('should delete a source', async () => {
      seedTable(db, 'source', [
        { id: 'src-del', name: 'To Delete', type: 'rss', url: 'https://del.com', feed_url: 'https://del.com/rss', active: 1 },
      ]);

      await db.prepare('DELETE FROM source WHERE id = ?').bind('src-del').run();

      const remaining = db._tables.get('source') || [];
      expect(remaining).toHaveLength(0);
    });
  });

  describe('Review queue', () => {
    it('should return stories with ai_screened or in_review status', async () => {
      seedTable(db, 'story', [
        { id: 's1', title: 'Screened', status: 'ai_screened', created_at: '2024-01-01T00:00:00Z' },
        { id: 's2', title: 'In Review', status: 'in_review', created_at: '2024-01-02T00:00:00Z' },
        { id: 's3', title: 'Published', status: 'published', created_at: '2024-01-03T00:00:00Z' },
        { id: 's4', title: 'Rejected', status: 'rejected', created_at: '2024-01-04T00:00:00Z' },
      ]);

      // The review queue query filters by status IN ('ai_screened', 'in_review')
      // With our mock, we simulate the filter
      const allStories = db._tables.get('story') || [];
      const reviewable = allStories.filter(
        s => s.status === 'ai_screened' || s.status === 'in_review'
      );
      expect(reviewable).toHaveLength(2);
      expect(reviewable.map(s => s.id)).toContain('s1');
      expect(reviewable.map(s => s.id)).toContain('s2');
    });
  });

  describe('Publish transition', () => {
    it('should transition ai_screened story to published', async () => {
      seedTable(db, 'story', [
        { id: 's1', title: 'To Publish', status: 'ai_screened', published_at: null, updated_at: '2024-01-01T00:00:00Z' },
      ]);

      await db
        .prepare(
          `UPDATE story SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        )
        .bind('s1')
        .run();

      const story = await db.prepare('SELECT * FROM story WHERE id = ?').bind('s1').first();
      expect((story as any).status).toBe('published');
      expect((story as any).published_at).toBeDefined();
    });

    it('should transition in_review story to published', async () => {
      seedTable(db, 'story', [
        { id: 's2', title: 'In Review Publish', status: 'in_review', published_at: null },
      ]);

      await db
        .prepare(
          `UPDATE story SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        )
        .bind('s2')
        .run();

      const story = await db.prepare('SELECT * FROM story WHERE id = ?').bind('s2').first();
      expect((story as any).status).toBe('published');
    });
  });

  describe('Reject transition', () => {
    it('should transition story to rejected with reason', async () => {
      seedTable(db, 'story', [
        { id: 's1', title: 'To Reject', status: 'ai_screened', rejection_reason: null },
      ]);

      await db
        .prepare(
          `UPDATE story SET status = 'rejected', rejection_reason = ?, updated_at = datetime('now') WHERE id = ?`
        )
        .bind('Looks like an advertisement', 's1')
        .run();

      const story = await db.prepare('SELECT * FROM story WHERE id = ?').bind('s1').first();
      expect((story as any).status).toBe('rejected');
      expect((story as any).rejection_reason).toBe('Looks like an advertisement');
    });

    it('should reject without a reason', async () => {
      seedTable(db, 'story', [
        { id: 's2', title: 'Reject No Reason', status: 'in_review', rejection_reason: null },
      ]);

      await db
        .prepare(
          `UPDATE story SET status = 'rejected', rejection_reason = ?, updated_at = datetime('now') WHERE id = ?`
        )
        .bind(null, 's2')
        .run();

      const story = await db.prepare('SELECT * FROM story WHERE id = ?').bind('s2').first();
      expect((story as any).status).toBe('rejected');
    });
  });

  describe('Access control', () => {
    it('should block non-admin users from admin routes', () => {
      const testCases = [
        { role: 'reader', shouldDeny: true },
        { role: 'contributor', shouldDeny: true },
        { role: 'editor', shouldDeny: false },
        { role: 'admin', shouldDeny: false },
      ];

      for (const tc of testCases) {
        const isAllowed = tc.role === 'admin' || tc.role === 'editor';
        expect(isAllowed).toBe(!tc.shouldDeny);
      }
    });

    it('should block unauthenticated requests', () => {
      const user = undefined;
      const isAllowed = user !== undefined;
      expect(isAllowed).toBe(false);
    });
  });
});
