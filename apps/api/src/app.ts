import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { noUser, type ResolveUser } from './auth.js';
import { createCatalog } from './catalog.js';
import { InMemoryChainStore } from './chains/memory.js';
import type { ChainStore } from './chains/types.js';
import { FakeAccountDirectory, InMemoryProfileStore, InMemoryRatingStore } from './fans/memory.js';
import type { AccountDirectory, ProfileStore, RatingStore } from './fans/types.js';
import { episodesRouter } from './routes/episodes.js';
import { fansRouter } from './routes/fans.js';
import { InMemoryEpisodeStore } from './stores/memory.js';
import type { EpisodeStore } from './stores/types.js';

export interface AppDeps {
  store?: EpisodeStore;
  /** Chain categories and websites, from the import's classification. */
  chainStore?: ChainStore;
  ratingStore?: RatingStore;
  profileStore?: ProfileStore;
  accounts?: AccountDirectory;
  /** Who's signed in. Defaults to nobody, so a misconfigured app fails closed. */
  resolveUser?: ResolveUser;
  /** Origins allowed to call the API from a browser. Omit to allow any origin. */
  allowedOrigins?: string[];
  /** How long to reuse the episode list. Tests pass 0. */
  cacheMs?: number;
  clock?: () => Date;
}

export function createApp({
  store = new InMemoryEpisodeStore(),
  chainStore = new InMemoryChainStore(),
  ratingStore = new InMemoryRatingStore(),
  profileStore = new InMemoryProfileStore(),
  accounts = new FakeAccountDirectory(),
  resolveUser = noUser,
  allowedOrigins,
  cacheMs = 5 * 60 * 1000,
  clock = () => new Date(),
}: AppDeps = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: allowedOrigins ?? '*' }));
  app.use(express.json({ limit: '20kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const catalog = createCatalog(store, chainStore, ratingStore, cacheMs);
  app.use('/api', episodesRouter(store, catalog));
  app.use(
    '/api',
    fansRouter({
      store,
      catalog,
      ratings: ratingStore,
      profiles: profileStore,
      accounts,
      resolveUser,
      clock,
    }),
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    // Malformed JSON bodies are the client's fault, not a server error.
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(errorHandler);

  return app;
}
