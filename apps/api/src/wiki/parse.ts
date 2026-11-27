import wtf from 'wtf_wikipedia';
import {
  averageForks,
  parseForks,
  seriesFor,
  type Episode,
  type Rating,
} from '@doughboys-app/shared';

export const WIKI_BASE = 'https://doughboys.fandom.com/wiki/';

export function wikiUrl(title: string) {
  return WIKI_BASE + encodeURIComponent(title.replaceAll(' ', '_'));
}

/** Page titles as links write them and as the API returns them can differ in spaces/underscores. */
export function normalizeTitle(title: string) {
  return title.replaceAll('_', ' ').trim();
}

/** "May 28, 2015" → "2015-05-28". Undefined when it isn't a date. */
export function toIsoDate(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const parsed = new Date(`${text.trim()} UTC`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

/** "Alison Agosti and Dave Ferguson", "A, B & C" → ["Alison Agosti", "Dave Ferguson"]. */
function splitNames(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\s*(?:,|&|\band\b)\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** wtf_wikipedia flattens a bullet list in a cell to "* Coffee * Splashberry ** extra". */
function splitOrders(text: string): string[] {
  if (!text.includes('*')) return [];
  return text
    .split(/\s*\*+\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

type Cell = { text?: string };
type Row = Record<string, Cell>;

const SCORE = /-?\d[\d.½¼¾]*\s*(forks?|spoons?)\b/i;

/**
 * Reads the "Fork rating" table. Columns shift when a cell spans rows (one person's orders
 * shared with another), so instead of trusting column names this takes the first cell as the
 * person, the cell that reads like "N forks" as the rating, and any bullet lists as orders.
 */
function parseRatingRows(rows: Row[]): Rating[] {
  const ratings: Rating[] = [];
  for (const row of rows) {
    const cells = Object.values(row).map((cell) => (cell.text ?? '').trim());
    const [person, ...rest] = cells;
    if (!person || /^shared$/i.test(person)) continue;
    const raw = rest.find((cell) => SCORE.test(cell)) ?? rest.at(-1) ?? '';
    // A cell can hold several scores ("* 4 forks * 3 dinner plates"); forks/spoons come first.
    const score = SCORE.exec(raw);
    ratings.push({
      person,
      forks: parseForks(score?.[0] ?? raw),
      unit: /spoon/i.test(score?.[1] ?? '') ? 'spoons' : 'forks',
      raw,
      ordered: rest.filter((cell) => cell !== raw).flatMap(splitOrders),
    });
  }
  return ratings;
}

/**
 * Turns one episode page's wikitext into an Episode. Returns undefined for pages without an
 * episode infobox. The restaurant comes from the Restaurants list, not the episode page.
 */
export function parseEpisodePage(title: string, wikitext: string): Episode | undefined {
  const doc = wtf(wikitext);
  const infobox = doc
    .templates()
    .map((template) => template.json() as Record<string, string | undefined>)
    .find((template) => template.template === 'infoboxep');
  if (!infobox) return undefined;

  // Usually "Fork rating"; also "Little Pink Spoon rating", "Fork and Dinner Plate rating".
  const ratingsSection = doc.sections().find((section) => /\brating\b/i.test(section.title()));
  // wtf_wikipedia types a section's tables loosely; at runtime it's an array of Table.
  const table = (ratingsSection?.tables() as { json(): object }[] | undefined)?.[0];
  const ratings = table ? parseRatingRows(table.json() as Row[]) : [];

  const number = infobox.ep_number?.trim() || undefined;
  return {
    slug: normalizeTitle(title),
    title: infobox.title1?.trim() || normalizeTitle(title),
    number,
    series: seriesFor(number),
    releaseDate: toIsoDate(infobox.release_date),
    guests: splitNames(infobox.guest),
    ratings,
    averageForks: averageForks(ratings),
    wikiUrl: wikiUrl(title),
  };
}

export interface RestaurantEntry {
  restaurant: string;
  /** The wiki's overall score for that visit, when it has one. */
  rating?: number;
}

/**
 * Reads the "Restaurants" list page into a map from episode page title to what it reviewed.
 * When an episode covers several places, the first one with a rating wins.
 */
export function parseRestaurantsPage(wikitext: string): Map<string, RestaurantEntry> {
  const byEpisode = new Map<string, RestaurantEntry>();
  const rated = new Set<string>();
  for (const table of wtf(wikitext).tables()) {
    for (const row of table.json() as Record<string, Cell & { links?: { page?: string }[] }>[]) {
      // Collapse odd spacing: some names use a non-breaking space, which nothing else
      // (search, Claude's answers) would match.
      const restaurant = row.Restaurant?.text?.replace(/\s+/gu, ' ').trim();
      const page = row.Episode?.links?.find((link) => link.page)?.page;
      if (!restaurant || !page) continue;
      const key = normalizeTitle(page);
      const rating = parseForks(row.Rating?.text ?? '') ?? undefined;
      if (!byEpisode.has(key) || (rating !== undefined && !rated.has(key))) {
        byEpisode.set(key, rating === undefined ? { restaurant } : { restaurant, rating });
        if (rating !== undefined) rated.add(key);
      }
    }
  }
  return byEpisode;
}
