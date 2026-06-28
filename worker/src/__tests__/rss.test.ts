import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFeed, normaliseDate, stripHtml } from '../services/rss';

describe('RSS parsing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should parse a valid RSS 2.0 feed', async () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Test Feed</title>
          <item>
            <title>Good News Story</title>
            <description>A local park was restored by volunteers.</description>
            <link>https://example.com/story-1</link>
            <guid>guid-001</guid>
            <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Second Story</title>
            <description>Community centre reopens.</description>
            <link>https://example.com/story-2</link>
            <guid>guid-002</guid>
            <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(rssXml),
    }));

    const entries = await fetchFeed('https://example.com/feed.xml');
    expect(entries).toHaveLength(2);
    expect(entries[0].title).toBe('Good News Story');
    expect(entries[0].description).toBe('A local park was restored by volunteers.');
    expect(entries[0].link).toBe('https://example.com/story-1');
    expect(entries[0].guid).toBe('guid-001');
    expect(entries[1].title).toBe('Second Story');
  });

  it('should parse a valid Atom feed', async () => {
    const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Feed</title>
        <entry>
          <title>Atom Story</title>
          <summary>Summary of the story.</summary>
          <link rel="alternate" href="https://example.com/atom-1" />
          <id>atom-guid-001</id>
          <updated>2024-01-15T10:00:00Z</updated>
        </entry>
      </feed>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(atomXml),
    }));

    const entries = await fetchFeed('https://example.com/atom.xml');
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Atom Story');
    expect(entries[0].description).toBe('Summary of the story.');
    expect(entries[0].link).toBe('https://example.com/atom-1');
    expect(entries[0].guid).toBe('atom-guid-001');
  });

  it('should handle empty RSS feed', async () => {
    const emptyRss = `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Empty Feed</title>
        </channel>
      </rss>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(emptyRss),
    }));

    const entries = await fetchFeed('https://example.com/empty.xml');
    expect(entries).toHaveLength(0);
  });

  it('should handle malformed XML by throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('not xml at all {{{'),
    }));

    await expect(fetchFeed('https://example.com/bad.xml')).rejects.toThrow();
  });

  it('should strip HTML from descriptions', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(stripHtml('No HTML here')).toBe('No HTML here');
    expect(stripHtml('&amp; &lt;tag&gt; &quot;quoted&quot;')).toBe('& <tag> "quoted"');
    expect(stripHtml('Has&nbsp;spaces')).toBe('Has spaces');
  });

  it('should normalise dates', () => {
    // Valid date
    const result = normaliseDate('Mon, 01 Jan 2024 12:00:00 GMT');
    expect(result).toBe('2024-01-01T12:00:00.000Z');

    // ISO date
    const iso = normaliseDate('2024-06-15T10:30:00Z');
    expect(iso).toBe('2024-06-15T10:30:00.000Z');

    // Invalid date falls back to now
    const invalid = normaliseDate('not-a-date');
    const parsed = new Date(invalid);
    expect(parsed.getTime()).not.toBeNaN();
    // Should be close to now
    expect(Math.abs(parsed.getTime() - Date.now())).toBeLessThan(5000);

    // Undefined falls back to now
    const undef = normaliseDate(undefined);
    const parsedUndef = new Date(undef);
    expect(parsedUndef.getTime()).not.toBeNaN();
  });

  it('should handle single-item feeds (not wrapped in array)', async () => {
    const singleItemRss = `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Single Item</title>
          <item>
            <title>Only Story</title>
            <description>The only one.</description>
            <link>https://example.com/only</link>
            <guid>guid-single</guid>
          </item>
        </channel>
      </rss>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(singleItemRss),
    }));

    const entries = await fetchFeed('https://example.com/single.xml');
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Only Story');
  });

  it('should throw on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    await expect(fetchFeed('https://example.com/missing.xml')).rejects.toThrow('Feed returned HTTP 404');
  });

  it('should throw on unrecognised feed format', async () => {
    const unknownXml = `<?xml version="1.0"?><something><else>hi</else></something>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(unknownXml),
    }));

    await expect(fetchFeed('https://example.com/unknown.xml')).rejects.toThrow('Unrecognised feed format');
  });
});
