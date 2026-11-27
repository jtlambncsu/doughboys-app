import type { Chain, ChainInfo, EpisodeSummary } from './episode.js';

/**
 * A chain's URL-safe id: "Which Wich?" → "which-wich", "A&W Canada" → "a-and-w-canada".
 * Spelling variants on the wiki ("Papa Johns", "Papa John's") get the same slug, so they
 * count as one chain. Names in URL paths are fragile: API Gateway decodes "%3F" back to "?".
 */
export function chainSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const byDate = (a: EpisodeSummary, b: EpisodeSummary) =>
  (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '');

/** Groups episodes by chain slug. */
export function episodesByChain<T extends EpisodeSummary>(episodes: T[]): Map<string, T[]> {
  const bySlug = new Map<string, T[]>();
  for (const episode of episodes) {
    if (!episode.restaurant) continue;
    const slug = chainSlug(episode.restaurant);
    const list = bySlug.get(slug) ?? [];
    list.push(episode);
    bySlug.set(slug, list);
  }
  return bySlug;
}

/** The spelling most episodes use (the earliest on a tie). */
export function displayName(visits: EpisodeSummary[]): string {
  const counts = new Map<string, number>();
  for (const v of visits) counts.set(v.restaurant!, (counts.get(v.restaurant!) ?? 0) + 1);
  return [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

/** Category and website from whichever spelling was classified, preferring the display name. */
function infoFor(name: string, visits: EpisodeSummary[], info: ReadonlyMap<string, ChainInfo>) {
  return info.get(name) ?? visits.map((v) => info.get(v.restaurant!)).find(Boolean);
}

/** A plain mean of rated visits: episode scores are already cleaned up, and can top 5. */
function average(rated: EpisodeSummary[]) {
  return (
    Math.round((rated.reduce((sum, v) => sum + v.averageForks!, 0) / rated.length) * 100) / 100
  );
}

/** One chain's leaderboard row, or undefined if no visit has a score. */
export function chainRow(
  slug: string,
  visits: EpisodeSummary[],
  info: ReadonlyMap<string, ChainInfo> = new Map(),
): Chain | undefined {
  const rated = visits.filter((v) => v.averageForks !== undefined);
  if (rated.length === 0) return undefined;
  const name = displayName(visits);
  const known = infoFor(name, visits, info);
  return {
    slug,
    name,
    averageForks: average(rated),
    visits: visits.length,
    ratedVisits: rated.length,
    latestEpisode: visits.reduce((a, b) => (byDate(a, b) < 0 ? b : a)).slug,
    ...(known && { category: known.category }),
    ...(known?.domain && { domain: known.domain }),
  };
}

/**
 * Builds the leaderboard: one row per chain with a score, averaging every rated visit,
 * best first. `info` adds each chain's category and website when known.
 */
export function chainLeaderboard(
  episodes: EpisodeSummary[],
  info: ReadonlyMap<string, ChainInfo> = new Map(),
): Chain[] {
  return [...episodesByChain(episodes)]
    .flatMap(([slug, visits]) => chainRow(slug, visits, info) ?? [])
    .sort((a, b) => b.averageForks - a.averageForks || a.name.localeCompare(b.name));
}

/** Restaurant names that appear in episodes, with a few episode titles each for context. */
export function chainsInEpisodes(episodes: EpisodeSummary[]): Map<string, string[]> {
  const titles = new Map<string, string[]>();
  for (const episode of episodes) {
    if (!episode.restaurant) continue;
    const list = titles.get(episode.restaurant) ?? [];
    if (list.length < 3) list.push(episode.title);
    titles.set(episode.restaurant, list);
  }
  return titles;
}
