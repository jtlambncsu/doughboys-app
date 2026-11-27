import type { Chain, ChainInfo, EpisodeSummary } from './episode.js';

const byDate = (a: EpisodeSummary, b: EpisodeSummary) =>
  (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '');

/**
 * Builds the leaderboard: one row per restaurant with a score, averaging every rated visit,
 * best first. `info` adds each chain's category and website when known.
 */
export function chainLeaderboard(
  episodes: EpisodeSummary[],
  info: ReadonlyMap<string, ChainInfo> = new Map(),
): Chain[] {
  const byName = new Map<string, EpisodeSummary[]>();
  for (const episode of episodes) {
    if (!episode.restaurant) continue;
    const list = byName.get(episode.restaurant) ?? [];
    list.push(episode);
    byName.set(episode.restaurant, list);
  }

  const chains: Chain[] = [];
  for (const [name, visits] of byName) {
    const rated = visits.filter((v) => v.averageForks !== undefined);
    if (rated.length === 0) continue;
    const known = info.get(name);
    chains.push({
      name,
      // A plain mean: episode scores are already cleaned up, and the wiki's can top 5.
      averageForks:
        Math.round((rated.reduce((sum, v) => sum + v.averageForks!, 0) / rated.length) * 100) / 100,
      visits: visits.length,
      ratedVisits: rated.length,
      latestEpisode: visits.reduce((a, b) => (byDate(a, b) < 0 ? b : a)).slug,
      ...(known && { category: known.category }),
      ...(known?.domain && { domain: known.domain }),
    });
  }
  return chains.sort((a, b) => b.averageForks - a.averageForks || a.name.localeCompare(b.name));
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
