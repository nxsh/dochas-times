import { XMLParser } from 'fast-xml-parser';

export interface FeedEntry {
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

export function normaliseDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function textOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (node && typeof node === 'object' && '#text' in (node as Record<string, unknown>)) {
    return String((node as Record<string, string>)['#text']);
  }
  return String(node ?? '');
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

function parseRss(data: Record<string, unknown>): FeedEntry[] {
  const channel = (data.rss as Record<string, unknown>)?.channel as Record<string, unknown>;
  if (!channel) return [];

  const items = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];

  return (items as Record<string, unknown>[]).map((item) => {
    const title = stripHtml(textOf(item.title));
    const description = stripHtml(textOf(item.description || item['content:encoded'] || ''));
    const link = textOf(item.link);
    const guid = textOf(item.guid || item.link);
    const pubDate = normaliseDate(textOf(item.pubDate));

    return { title, description, link, guid, pubDate };
  });
}

function parseAtom(data: Record<string, unknown>): FeedEntry[] {
  const feed = data.feed as Record<string, unknown>;
  if (!feed) return [];

  const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];

  return (entries as Record<string, unknown>[]).map((entry) => {
    const title = stripHtml(textOf(entry.title));
    const summary = stripHtml(textOf(entry.summary || entry.content || ''));
    const linkNode = Array.isArray(entry.link)
      ? (entry.link as Record<string, string>[]).find((l) => l['@_rel'] === 'alternate' || !l['@_rel'])
      : entry.link;
    const link = typeof linkNode === 'object' && linkNode
      ? (linkNode as Record<string, string>)['@_href'] || ''
      : textOf(linkNode);
    const guid = textOf(entry.id || link);
    const pubDate = normaliseDate(textOf(entry.updated || entry.published));

    return { title, description: summary, link, guid, pubDate };
  });
}

export async function fetchFeed(feedUrl: string): Promise<FeedEntry[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DochasTimes/1.0 RSS Aggregator' },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`Feed returned HTTP ${res.status}`);
    }

    const xml = await res.text();
    const data = parser.parse(xml) as Record<string, unknown>;

    if (data.rss) return parseRss(data);
    if (data.feed) return parseAtom(data);

    throw new Error('Unrecognised feed format');
  } finally {
    clearTimeout(timeout);
  }
}
