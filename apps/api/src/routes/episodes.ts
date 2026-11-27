import { Router } from 'express';
import {
  chainLeaderboard,
  type ChainDetail,
  type ChainInfo,
  type EpisodeSummary,
} from '@doughboys-app/shared';
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

  // One chain with every episode that featured it, for its page.
  router.get('/chains/:name', async (req, res) => {
    const [episodes, info] = await Promise.all([list(), chainInfo()]);
    const name = req.params.name;
    const slugs = episodes.filter((e) => e.restaurant === name).map((e) => e.slug);
    if (slugs.length === 0) {
      res.status(404).json({ error: 'Chain not found' });
      return;
    }
    const full = (await store.getEpisodes(slugs)).sort((a, b) =>
      (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''),
    );
    const known = info.get(name);
    const rated = full.filter((e) => e.averageForks !== undefined);
    const detail: ChainDetail = {
      name,
      ...(known && { category: known.category }),
      ...(known?.domain && { domain: known.domain }),
      // Same figure as the leaderboard's.
      ...(rated.length && {
        averageForks: chainLeaderboard(rated, info).find((c) => c.name === name)!.averageForks,
      }),
      visits: full.length,
      ratedVisits: rated.length,
      episodes: full,
    };
    res.json(detail);
  });

  return router;
}
