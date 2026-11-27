import { Router } from 'express';
import {
  chainLeaderboard,
  chainRow,
  displayName,
  episodesByChain,
  type ChainDetail,
} from '@doughboys-app/shared';
import type { Catalog } from '../catalog.js';
import type { EpisodeStore } from '../stores/types.js';

export function episodesRouter(store: EpisodeStore, catalog: Catalog) {
  const router = Router();
  const list = catalog.episodes;
  const chainInfo = catalog.chainInfo;

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
    const [episodes, info, audience] = await Promise.all([list(), chainInfo(), catalog.audience()]);
    res.json(
      chainLeaderboard(episodes, info).map((chain) => {
        const score = audience.get(chain.slug);
        return score ? { ...chain, audience: score } : chain;
      }),
    );
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
