import type { Episode, EpisodeSummary } from '@doughboys-app/shared';

/** Where episodes live. DynamoDB in AWS; in memory locally and in tests. */
export interface EpisodeStore {
  /** Adds or replaces episodes, matched by slug. */
  putEpisodes(episodes: Episode[]): Promise<void>;
  /** Every episode, newest first, without the per-person orders. */
  listEpisodes(): Promise<EpisodeSummary[]>;
  getEpisode(slug: string): Promise<Episode | undefined>;
  /** Several episodes at once, in any order; unknown slugs are skipped. */
  getEpisodes(slugs: string[]): Promise<Episode[]>;
}

export function toSummary({ ratings: _ratings, ...summary }: Episode): EpisodeSummary {
  return summary;
}

export function newestFirst(a: EpisodeSummary, b: EpisodeSummary) {
  return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.slug.localeCompare(b.slug);
}
