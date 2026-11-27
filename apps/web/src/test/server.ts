import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  chainLeaderboard,
  chainRow,
  displayName,
  episodesByChain,
  audienceScore,
  ratingInputSchema,
  type ChainInfo,
  type Episode,
  type FanRating,
  type MyRating,
  type RatingInput,
} from '@doughboys-app/shared';

/** The signed-in test fan's token (see renderApp). */
const TEST_TOKEN = 'test-token';

/** Other fans' ratings in tests carry a made-up owner; the test fan's are 'me'. */
type FakeRating = FanRating & { chain: string; owner: string };

/**
 * A tiny in-memory fake of our API. Tests talk to it through real `fetch` calls, which MSW
 * intercepts, so the API client, TanStack Query and the router all run for real.
 */
export const db = {
  episodes: new Map<string, Episode>(),
  /** Classified chains, by name. */
  chains: new Map<string, ChainInfo>(),
  /** The test fan's display name, once chosen. */
  displayName: undefined as string | undefined,
  fanRatings: [] as FakeRating[],
  /** Rating bodies the app sent, to check what the form submits. */
  ratingRequests: [] as RatingInput[],
  accountDeleted: false,
  /** How many times the app saved the profile. */
  profileSaves: 0,
  reset() {
    this.profileSaves = 0;
    this.episodes.clear();
    this.chains.clear();
    this.displayName = undefined;
    this.fanRatings = [];
    this.ratingRequests = [];
    this.accountDeleted = false;
  },
  /** Another fan's rating, for chain pages and audience scores. */
  addFanRating(chain: string, rating: Partial<FanRating> & { displayName: string; forks: number }) {
    this.fanRatings.push({
      updatedAt: '2026-12-01T00:00:00Z',
      ...rating,
      chain,
      owner: rating.displayName,
    });
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
      .map(({ ratings: _ratings, details: _details, ...summary }) => summary)
      .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
  },
};

export const handlers = [
  http.get('/api/episodes', () => HttpResponse.json(db.summaries())),
  http.get('/api/episodes/:slug', ({ params }) => {
    const episode = db.episodes.get(params.slug as string);
    return episode ? HttpResponse.json(episode) : HttpResponse.json({}, { status: 404 });
  }),
  http.get('/api/chains', () =>
    HttpResponse.json(
      chainLeaderboard(db.summaries(), db.chains).map((chain) => {
        const forks = db.fanRatings.filter((r) => r.chain === chain.slug).map((r) => r.forks);
        return forks.length ? { ...chain, audience: audienceScore(forks) } : chain;
      }),
    ),
  ),
  ...fanHandlers(),
  http.get('/api/chains/:slug', ({ params }) => {
    const slug = params.slug as string;
    const visits = episodesByChain([...db.episodes.values()]).get(slug);
    if (!visits) return HttpResponse.json({}, { status: 404 });
    const episodes = visits.sort((a, b) =>
      (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''),
    );
    const row = chainRow(
      slug,
      db.summaries().filter((e) => visits.some((v) => v.slug === e.slug)),
      db.chains,
    );
    return HttpResponse.json({
      slug,
      name: displayName(visits),
      ...(row?.category && { category: row.category }),
      ...(row?.domain && { domain: row.domain }),
      ...(row && { averageForks: row.averageForks }),
      visits: episodes.length,
      ratedVisits: row?.ratedVisits ?? 0,
      episodes,
    });
  }),
];

export const server = setupServer(...handlers);

const publicRating = ({ chain: _c, owner: _o, ...rating }: FakeRating): FanRating => rating;
const signedIn = (request: Request) =>
  request.headers.get('authorization') === `Bearer ${TEST_TOKEN}`;
const unauthorized = () => HttpResponse.json({ error: 'Not signed in' }, { status: 401 });
const chainExists = (slug: string) => episodesByChain([...db.episodes.values()]).has(slug);

/** Fans' endpoints, following the real API's rules (src/routes/fans.ts in the API). */
function fanHandlers() {
  return [
    http.get('/api/chains/:slug/ratings', ({ params }) => {
      const ratings = db.fanRatings.filter((r) => r.chain === params.slug);
      return HttpResponse.json({
        audience: audienceScore(ratings.map((r) => r.forks)),
        ratings: ratings.map(publicRating).reverse(),
      });
    }),
    http.get('/api/me', ({ request }) => {
      if (!signedIn(request)) return unauthorized();
      return HttpResponse.json(db.displayName ? { displayName: db.displayName } : {});
    }),
    http.put('/api/me', async ({ request }) => {
      if (!signedIn(request)) return unauthorized();
      const { displayName } = (await request.json()) as { displayName: string };
      db.displayName = displayName;
      db.profileSaves++;
      for (const r of db.fanRatings) if (r.owner === 'me') r.displayName = displayName;
      return HttpResponse.json({ displayName });
    }),
    http.delete('/api/me', ({ request }) => {
      if (!signedIn(request)) return unauthorized();
      db.fanRatings = db.fanRatings.filter((r) => r.owner !== 'me');
      db.displayName = undefined;
      db.accountDeleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('/api/me/ratings', ({ request }) => {
      if (!signedIn(request)) return unauthorized();
      const mine: MyRating[] = db.fanRatings
        .filter((r) => r.owner === 'me')
        .map((r) => ({ ...publicRating(r), chain: r.chain, chainName: r.chain }));
      return HttpResponse.json(mine);
    }),
    http.put('/api/chains/:slug/rating', async ({ request, params }) => {
      if (!signedIn(request)) return unauthorized();
      const slug = params.slug as string;
      if (!chainExists(slug))
        return HttpResponse.json({ error: 'Chain not found' }, { status: 404 });
      const body = (await request.json()) as RatingInput;
      db.ratingRequests.push(body);
      const parsed = ratingInputSchema.safeParse(body);
      if (!parsed.success) {
        return HttpResponse.json(
          {
            error: 'Invalid input',
            issues: parsed.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
          { status: 400 },
        );
      }
      if (!db.displayName) {
        return HttpResponse.json({ error: 'Choose a display name before rating' }, { status: 409 });
      }
      db.fanRatings = db.fanRatings.filter((r) => !(r.chain === slug && r.owner === 'me'));
      const rating: FakeRating = {
        ...parsed.data,
        displayName: db.displayName,
        updatedAt: new Date().toISOString(),
        chain: slug,
        owner: 'me',
      };
      db.fanRatings.push(rating);
      return HttpResponse.json(publicRating(rating));
    }),
    http.delete('/api/chains/:slug/rating', ({ request, params }) => {
      if (!signedIn(request)) return unauthorized();
      db.fanRatings = db.fanRatings.filter((r) => !(r.chain === params.slug && r.owner === 'me'));
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
