import { decode } from 'he';
import { XMLParser } from 'fast-xml-parser';
import { chainSlug, type Episode } from '@doughboys-app/shared';

/** The official Doughboys podcast feed, which every podcast app reads. */
export const FEED_URL = 'https://rss.art19.com/doughboys';

/** A numbered main-show episode as the feed describes it. */
export interface FeedEpisode {
  number: string;
  title: string;
  /** ISO date, YYYY-MM-DD. */
  releaseDate: string;
  synopsis?: string;
  /** "…before a review of Chipotle." → "Chipotle". */
  reviewOf?: string;
}

/** Where the importer gets the feed. Tests pass a fake. */
export interface FeedSource {
  episodes(): Promise<FeedEpisode[]>;
}

/** HTML description → plain text, up to the promo boilerplate ("Watch this episode at…"). */
export function descriptionText(html: string): string | undefined {
  const text = decode(
    html
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const end = text.findIndex((p) =>
    /^(Watch this episode|Get ad-free|See Privacy Policy)/i.test(p),
  );
  const kept = (end === -1 ? text : text.slice(0, end)).join('\n\n');
  return kept || undefined;
}

function textOf(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return textOf(value[0]);
  if (value && typeof value === 'object' && '#text' in value) return textOf(value['#text']);
  return '';
}

/** Reads the feed's XML. Only numbered main-show episodes; bonus and unlocked ones are skipped. */
export function parseFeed(xml: string): FeedEpisode[] {
  const parser = new XMLParser({ ignoreAttributes: true, processEntities: true });
  const rss = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
  const rawItems = rss.rss?.channel?.item;
  const items = (Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []) as Record<
    string,
    unknown
  >[];

  return items.flatMap((item) => {
    const number = textOf(item['itunes:episode']).trim();
    if (!/^\d+$/.test(number)) return [];
    const date = new Date(textOf(item.pubDate));
    if (Number.isNaN(date.getTime())) return [];
    const synopsis = descriptionText(textOf(item.description));
    const reviewOf = synopsis?.match(/before a review of (.+?)[.!]/i)?.[1]?.trim();
    return [
      {
        number,
        title: textOf(item.title).trim(),
        releaseDate: date.toISOString().slice(0, 10),
        ...(synopsis && { synopsis }),
        ...(reviewOf && { reviewOf }),
      },
    ];
  });
}

export class PodcastFeedSource implements FeedSource {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async episodes() {
    const response = await this.fetchImpl(FEED_URL, {
      headers: { 'User-Agent': 'doughboys-app-importer/0.1 (fan project; read-only)' },
    });
    if (!response.ok) throw new Error(`Podcast feed ${response.status}`);
    return parseFeed(await response.text());
  }
}

/**
 * A feed episode as an Episode, for numbers the wiki doesn't have yet. Its chain is the
 * known chain named in "before a review of …" (matched by slug, so "Chipotle" finds
 * "Chipotle"), or that name as written.
 */
export function episodeFromFeed(item: FeedEpisode, knownChains: Map<string, string>): Episode {
  const restaurant = item.reviewOf
    ? (knownChains.get(chainSlug(item.reviewOf)) ?? item.reviewOf)
    : undefined;
  return {
    slug: item.title,
    title: item.title,
    number: item.number,
    series: 'main',
    releaseDate: item.releaseDate,
    ...(restaurant && { restaurant }),
    guests: [],
    ratings: [],
    source: 'feed',
    details: {
      ...(item.synopsis && { synopsis: item.synopsis }),
      quotes: [],
      roasts: [],
      related: [],
    },
  };
}
