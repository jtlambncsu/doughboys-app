import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { chainLeaderboard, type ChainInfo, type Episode } from '@doughboys-app/shared';

/**
 * A tiny in-memory fake of our API. Tests talk to it through real `fetch` calls, which MSW
 * intercepts, so the API client, TanStack Query and the router all run for real.
 */
export const db = {
  episodes: new Map<string, Episode>(),
  /** Classified chains, by name. */
  chains: new Map<string, ChainInfo>(),
  reset() {
    this.episodes.clear();
    this.chains.clear();
  },
  add(episode: Partial<Episode> & { slug: string }) {
    const full: Episode = {
      title: episode.slug,
      series: 'main',
      guests: [],
      ratings: [],
      wikiUrl: `https://doughboys.fandom.com/wiki/${encodeURIComponent(episode.slug)}`,
      ...episode,
    };
    this.episodes.set(full.slug, full);
    return full;
  },
  summaries() {
    return [...this.episodes.values()]
      .map(({ ratings: _ratings, ...summary }) => summary)
      .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
  },
};

export const handlers = [
  http.get('/api/episodes', () => HttpResponse.json(db.summaries())),
  http.get('/api/episodes/:slug', ({ params }) => {
    const episode = db.episodes.get(params.slug as string);
    return episode ? HttpResponse.json(episode) : HttpResponse.json({}, { status: 404 });
  }),
  http.get('/api/chains', () => HttpResponse.json(chainLeaderboard(db.summaries(), db.chains))),
];

export const server = setupServer(...handlers);
