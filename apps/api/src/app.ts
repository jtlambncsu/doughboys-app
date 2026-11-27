import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { episodesRouter } from './routes/episodes.js';
import { InMemoryChainStore } from './chains/memory.js';
import type { ChainStore } from './chains/types.js';
import { InMemoryEpisodeStore } from './stores/memory.js';
import type { EpisodeStore } from './stores/types.js';

export interface AppDeps {
  store?: EpisodeStore;
  /** Chain categories and websites, from the import's classification. */
  chainStore?: ChainStore;
  /** Origins allowed to call the API from a browser. Omit to allow any origin. */
  allowedOrigins?: string[];
  /** How long to reuse the episode list. Tests pass 0. */
  cacheMs?: number;
}

export function createApp({
  store = new InMemoryEpisodeStore(),
  chainStore = new InMemoryChainStore(),
  allowedOrigins,
  cacheMs = 5 * 60 * 1000,
}: AppDeps = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: allowedOrigins ?? '*' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Public, read-only data from the wiki. Signed-in features (your own ratings) come later.
  app.use('/api', episodesRouter(store, chainStore, cacheMs));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(errorHandler);

  return app;
}
