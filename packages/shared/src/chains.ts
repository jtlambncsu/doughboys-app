import type { Chain, EpisodeSummary } from './episode.js';

/**
 * Builds the leaderboard: one row per restaurant, averaging every rated visit, best first.
 * Episodes without a restaurant or without a numeric rating are left out.
 */
export function chainLeaderboard(episodes: EpisodeSummary[]): Chain[] {
  const byName = new Map<string, EpisodeSummary[]>();
  for (const episode of episodes) {
    if (!episode.restaurant || episode.averageForks === undefined) continue;
    const list = byName.get(episode.restaurant) ?? [];
    list.push(episode);
    byName.set(episode.restaurant, list);
  }

  return [...byName.entries()]
    .map(([name, visits]) => {
      const latest = visits.reduce((a, b) =>
        (b.releaseDate ?? '') > (a.releaseDate ?? '') ? b : a,
      );
      return {
        name,
        // A plain mean: episode scores are already cleaned up, and the wiki's can top 5.
        averageForks:
          Math.round((visits.reduce((sum, v) => sum + v.averageForks!, 0) / visits.length) * 100) /
          100,
        episodeCount: visits.length,
        latestEpisode: latest.slug,
      };
    })
    .sort((a, b) => b.averageForks - a.averageForks || a.name.localeCompare(b.name));
}
