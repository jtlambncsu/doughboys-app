import { Router } from 'express';
import { chainLeaderboard, type EpisodeSummary } from '@doughboys-app/shared';
import type { EpisodeStore } from '../stores/types.js';

/**
 * Episode data changes about once a week, so the list is kept for a few minutes per Lambda
 * container instead of scanning DynamoDB on every request.
 */
function cachedList(store: EpisodeStore, ttlMs: number, now: () => number) {
  let cached: { at: number; value: Promise<EpisodeSummary[]> } | undefined;
  return () => {
    if (!cached || now() - cached.at > ttlMs) {
      const value = store.listEpisodes();
      cached = { at: now(), value };
      value.catch(() => (cached = undefined)); // don't keep a failure around
    }
    return cached.value;
  };
}

export function episodesRouter(store: EpisodeStore, cacheMs: number, now = Date.now) {
  const router = Router();
  const list = cachedList(store, cacheMs, now);

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
    res.json(chainLeaderboard(await list()));
  });

  return router;
}
