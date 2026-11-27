import { Router } from 'express';
import {
  chainLeaderboard,
  chainRow,
  displayName,
  episodesByChain,
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

  // One chain (by slug) with every episode that featured it, for its page.
  router.get('/chains/:slug', async (req, res) => {
    const [episodes, info] = await Promise.all([list(), chainInfo()]);
    const slug = req.params.slug;
    const visits = episodesByChain(episodes).get(slug);
    if (!visits) {
      res.status(404).json({ error: 'Chain not found' });
      return;
    }
    const full = (await store.getEpisodes(visits.map((v) => v.slug))).sort((a, b) =>
      (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''),
    );
    const row = chainRow(slug, visits, info); // same figures as the leaderboard
    const name = displayName(visits);
    const detail: ChainDetail = {
      slug,
      name,
      ...(row?.category && { category: row.category }),
      ...(row?.domain && { domain: row.domain }),
      ...(row && { averageForks: row.averageForks }),
      visits: full.length,
      ratedVisits: row?.ratedVisits ?? 0,
      episodes: full,
    };
    res.json(detail);
  });

  return router;
}
