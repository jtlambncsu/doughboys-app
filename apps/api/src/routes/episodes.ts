import { Router } from 'express';
import { chainLeaderboard, type ChainInfo, type EpisodeSummary } from '@doughboys-app/shared';
import { withOverrides } from '../chains/overrides.js';
import type { ChainStore } from '../chains/types.js';
import type { EpisodeStore } from '../stores/types.js';

/**
 * Episode data changes about once a week, so the list is kept for a few minutes per Lambda
 * container instead of scanning DynamoDB on every request.
 */
function cached<T>(load: () => Promise<T>, ttlMs: number, now: () => number) {
  let cached: { at: number; value: Promise<T> } | undefined;
  return () => {
    if (!cached || now() - cached.at > ttlMs) {
      const value = load();
      cached = { at: now(), value };
      value.catch(() => (cached = undefined)); // don't keep a failure around
    }
    return cached.value;
  };
}

export function episodesRouter(
  store: EpisodeStore,
  chainStore: ChainStore,
  cacheMs: number,
  now = Date.now,
) {
  const router = Router();
  const list = cached((): Promise<EpisodeSummary[]> => store.listEpisodes(), cacheMs, now);
  const chainInfo = cached(
    async (): Promise<Map<string, ChainInfo>> => withOverrides(await chainStore.all()),
    cacheMs,
    now,
  );

  router.get('/episodes', async (_req, res) => {
    res.json(await list());
  });

  router.get('/episodes/:slug', async (req, res) => {
    const episode = await store.getEpisode(req.params.slug);
    if (!episode) {
      res.status(404).json({ error: 'Episode not found' });
      return;
    }
    res.json(episode);
  });

  router.get('/chains', async (_req, res) => {
    const [episodes, info] = await Promise.all([list(), chainInfo()]);
    res.json(chainLeaderboard(episodes, info));
  });

  return router;
}
