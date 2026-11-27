import {
  audienceScore,
  episodesByChain,
  type AudienceScore,
  type ChainInfo,
  type EpisodeSummary,
} from '@doughboys-app/shared';
import { withOverrides } from './chains/overrides.js';
import type { ChainStore } from './chains/types.js';
import type { RatingStore } from './fans/types.js';
import type { EpisodeStore } from './stores/types.js';

/**
 * Keeps a value for a while per Lambda container instead of reading DynamoDB on every
 * request. `clear()` drops it early (after a fan rates, so they see their change).
 */
export function cached<T>(load: () => Promise<T>, ttlMs: number, now: () => number = Date.now) {
  let entry: { at: number; value: Promise<T> } | undefined;
  const get = () => {
    if (!entry || now() - entry.at > ttlMs) {
      const value = load();
      entry = { at: now(), value };
      value.catch(() => (entry = undefined)); // don't keep a failure around
    }
    return entry.value;
  };
  return Object.assign(get, { clear: () => (entry = undefined) });
}

/** Read-mostly data shared by the routes: episodes, chain labels and audience scores. */
export function createCatalog(
  store: EpisodeStore,
  chainStore: ChainStore,
  ratingStore: RatingStore,
  cacheMs: number,
) {
  // Episode data changes about once a day; fans' ratings change any time, so they're kept
  // briefly and cleared on every rating change in this container.
  const episodes = cached((): Promise<EpisodeSummary[]> => store.listEpisodes(), cacheMs);
  const chainInfo = cached(
    async (): Promise<Map<string, ChainInfo>> => withOverrides(await chainStore.all()),
    cacheMs,
  );
  const audience = cached(
    async (): Promise<Map<string, AudienceScore>> => {
      const byChain = new Map<string, number[]>();
      for (const rating of await ratingStore.all()) {
        byChain.set(rating.chain, [...(byChain.get(rating.chain) ?? []), rating.forks]);
      }
      return new Map([...byChain].map(([slug, forks]) => [slug, audienceScore(forks)]));
    },
    Math.min(cacheMs, 60_000),
  );

  return {
    episodes,
    chainInfo,
    audience,
    /** The episodes that featured a chain, or undefined for an unknown slug. */
    async visits(slug: string) {
      return episodesByChain(await episodes()).get(slug);
    },
  };
}

export type Catalog = ReturnType<typeof createCatalog>;
