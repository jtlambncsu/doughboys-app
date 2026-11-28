import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Episode } from '@doughboys-app/shared';
import { createApp } from '../app.js';
import type { ResolveUser } from '../auth.js';
import {
  FakeAccountDirectory,
  FakeReportNotifier,
  InMemoryProfileStore,
  InMemoryRatingStore,
  InMemoryReportStore,
} from '../fans/memory.js';
import { InMemoryEpisodeStore } from '../stores/memory.js';

/** Tests say who's signed in with a header; in AWS it's the verified Cognito token. */
const fromHeader: ResolveUser = (req) => req.header('x-test-user') || undefined;

const episode = (slug: string, overrides: Partial<Episode> = {}): Episode => ({
  slug,
  title: slug,
  series: 'main',
  guests: [],
  ratings: [],
  restaurant: 'Taco Bell',
  wikiUrl: `https://doughboys.fandom.com/wiki/${slug}`,
  averageForks: 4,
  ...overrides,
});

let ratings: InMemoryRatingStore;
let profiles: InMemoryProfileStore;
let accounts: FakeAccountDirectory;
let reports: InMemoryReportStore;
let notifier: FakeReportNotifier;
let app: ReturnType<typeof createApp>;
let now: Date;

beforeEach(() => {
  ratings = new InMemoryRatingStore();
  profiles = new InMemoryProfileStore();
  accounts = new FakeAccountDirectory();
  reports = new InMemoryReportStore();
  notifier = new FakeReportNotifier();
  now = new Date('2026-12-01T12:00:00Z');
  app = createApp({
    store: new InMemoryEpisodeStore([
      episode('Taco Bell with Jack Allison', {
        ratings: [
          {
            person: 'Nick Wiger',
            forks: 4,
            unit: 'forks',
            raw: '4',
            ordered: ['Crunchwrap Supreme', 'Baja Blast'],
          },
          {
            person: 'Mike Mitchell',
            forks: 5,
            unit: 'forks',
            raw: '5',
            ordered: ['crunchwrap supreme'],
          },
        ],
      }),
      episode('IHOP with Alison Agosti', { restaurant: 'IHOP' }),
    ]),
    ratingStore: ratings,
    profileStore: profiles,
    accounts,
    reportStore: reports,
    notifier,
    resolveUser: fromHeader,
    cacheMs: 0,
    clock: () => now,
  });
});

const as = (user: string) => ({ 'x-test-user': user });

async function signUp(user: string, displayName: string) {
  await request(app).put('/api/me').set(as(user)).send({ displayName }).expect(200);
}

function rate(user: string, chain: string, body: object) {
  return request(app).put(`/api/chains/${chain}/rating`).set(as(user)).send(body);
}

describe('signed-in routes', () => {
  it.each([
    ['get', '/api/me'],
    ['put', '/api/me'],
    ['delete', '/api/me'],
    ['get', '/api/me/ratings'],
    ['put', '/api/chains/taco-bell/rating'],
    ['delete', '/api/chains/taco-bell/rating'],
  ] as const)('%s %s needs a signed-in fan', async (method, path) => {
    await request(app)[method](path).send({}).expect(401);
  });
});

describe('profile', () => {
  it('starts empty, saves a display name, and validates it', async () => {
    await request(app).get('/api/me').set(as('alice')).expect(200, {});
    await request(app)
      .put('/api/me')
      .set(as('alice'))
      .send({ displayName: '<b>hi</b>' })
      .expect(400);
    await signUp('alice', 'Spoonman Fan');
    await request(app).get('/api/me').set(as('alice')).expect(200, { displayName: 'Spoonman Fan' });
  });

  it('renames the fan on their existing ratings', async () => {
    await signUp('alice', 'Alice');
    await rate('alice', 'taco-bell', { forks: 4 }).expect(200);
    await signUp('alice', 'Alice B');
    const res = await request(app).get('/api/chains/taco-bell/ratings').expect(200);
    expect(res.body.ratings[0].displayName).toBe('Alice B');
  });
});

describe('rating a chain', () => {
  it('needs a display name first', async () => {
    const res = await rate('alice', 'taco-bell', { forks: 4 }).expect(409);
    expect(res.body.error).toMatch(/display name/);
  });

  it('rejects invalid ratings and unknown chains', async () => {
    await signUp('alice', 'Alice');
    const res = await rate('alice', 'taco-bell', { forks: 7 }).expect(400);
    expect(res.body.issues[0].path).toBe('forks');
    await rate('alice', 'no-such-chain', { forks: 4 }).expect(404);
    await request(app)
      .put('/api/chains/taco-bell/rating')
      .set(as('alice'))
      .set('content-type', 'application/json')
      .send('{not json')
      .expect(400);
  });

  it('keeps one rating per fan per chain: rating again replaces it', async () => {
    await signUp('alice', 'Alice');
    await rate('alice', 'taco-bell', { forks: 3, review: 'Fine.' }).expect(200);
    now = new Date('2026-12-02T12:00:00Z');
    await rate('alice', 'taco-bell', {
      forks: 4.5,
      ordered: ['Crunchwrap Supreme'], // retired field: ignored, not stored
      location: 'Burbank, CA',
    }).expect(200);

    const all = await ratings.forChain('taco-bell');
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      forks: 4.5,
      createdAt: '2026-12-01T12:00:00.000Z',
      updatedAt: '2026-12-02T12:00:00.000Z',
    });
    expect(all[0]).not.toHaveProperty('review'); // replaced, not merged
    expect(all[0]).not.toHaveProperty('ordered');
  });

  it('takes the fan from the token, never from the request', async () => {
    await signUp('alice', 'Alice');
    await rate('alice', 'taco-bell', { forks: 4, userId: 'bob', displayName: 'Bob' }).expect(200);
    expect(await ratings.forChain('taco-bell')).toEqual([
      expect.objectContaining({ userId: 'alice', displayName: 'Alice' }),
    ]);
  });

  it('lets a fan delete only their own rating', async () => {
    await signUp('alice', 'Alice');
    await signUp('bob', 'Bob');
    await rate('alice', 'taco-bell', { forks: 4 }).expect(200);
    await rate('bob', 'taco-bell', { forks: 2 }).expect(200);

    await request(app).delete('/api/chains/taco-bell/rating').set(as('bob')).expect(204);

    expect((await ratings.forChain('taco-bell')).map((r) => r.userId)).toEqual(['alice']);
  });
});

describe('public ratings', () => {
  it('shows ratings newest first without account IDs, and hides the average under 3', async () => {
    for (const [user, forks] of [
      ['a', 5],
      ['b', 4],
    ] as const) {
      await signUp(user, `Fan ${user}`);
      await rate(user, 'taco-bell', { forks, review: `From ${user}` }).expect(200);
      now = new Date(now.getTime() + 60_000);
    }
    const two = await request(app).get('/api/chains/taco-bell/ratings').expect(200);
    expect(two.body.audience).toEqual({ average: null, count: 2 });
    expect(two.body.ratings.map((r: { displayName: string }) => r.displayName)).toEqual([
      'Fan b',
      'Fan a',
    ]);
    expect(JSON.stringify(two.body)).not.toMatch(/userId|"a"|"b"/);

    await signUp('c', 'Fan c');
    await rate('c', 'taco-bell', { forks: 3 }).expect(200);
    const three = await request(app).get('/api/chains/taco-bell/ratings').expect(200);
    expect(three.body.audience).toEqual({ average: 4, count: 3 });
  });

  it('adds the audience score to the leaderboard', async () => {
    await signUp('a', 'Fan A');
    await rate('a', 'taco-bell', { forks: 5 }).expect(200);
    const res = await request(app).get('/api/chains').expect(200);
    const taco = res.body.find((c: { slug: string }) => c.slug === 'taco-bell');
    expect(taco.audience).toEqual({ average: null, count: 1 });
    expect(res.body.find((c: { slug: string }) => c.slug === 'ihop')).not.toHaveProperty(
      'audience',
    );
  });

  it('404s for an unknown chain', async () => {
    await request(app).get('/api/chains/nope/ratings').expect(404);
  });
});

describe('my ratings', () => {
  it('lists only my ratings, with chain names', async () => {
    await signUp('alice', 'Alice');
    await signUp('bob', 'Bob');
    await rate('alice', 'taco-bell', { forks: 4 }).expect(200);
    await rate('bob', 'ihop', { forks: 2 }).expect(200);
    const res = await request(app).get('/api/me/ratings').set(as('alice')).expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({ chain: 'taco-bell', chainName: 'Taco Bell', forks: 4 }),
    ]);
  });
});

describe('deleting an account', () => {
  it('removes the fan’s ratings, profile and sign-in account, and nobody else’s', async () => {
    await signUp('alice', 'Alice');
    await signUp('bob', 'Bob');
    await rate('alice', 'taco-bell', { forks: 4 }).expect(200);
    await rate('alice', 'ihop', { forks: 3 }).expect(200);
    await rate('bob', 'taco-bell', { forks: 2 }).expect(200);

    await request(app).delete('/api/me').set(as('alice')).expect(204);

    expect(await ratings.forUser('alice')).toEqual([]);
    expect(await profiles.get('alice')).toBeUndefined();
    expect(accounts.deleted).toEqual(['alice']);
    expect(await ratings.forUser('bob')).toHaveLength(1);
    expect(await profiles.get('bob')).toBeDefined();
  });

  it('doesn’t show order lists saved before the field was retired', async () => {
    await ratings.put({
      chain: 'taco-bell',
      userId: 'old-fan',
      displayName: 'Old Fan',
      forks: 4,
      ordered: ['Crunchwrap Supreme'],
      createdAt: '2026-11-27T00:00:00Z',
      updatedAt: '2026-11-27T00:00:00Z',
    } as never);
    const res = await request(app).get('/api/chains/taco-bell/ratings').expect(200);
    expect(res.body.ratings[0]).not.toHaveProperty('ordered');
  });
});

describe('reporting a review', () => {
  async function reviewBy(user: string, review = 'Terrible! Visit my-spam-site.example') {
    await signUp(user, `Fan ${user}`);
    await rate(user, 'taco-bell', { forks: 1, review, location: 'Somewhere' }).expect(200);
    const res = await request(app).get('/api/chains/taco-bell/ratings').expect(200);
    return res.body.ratings.find((r: { displayName: string }) => r.displayName === `Fan ${user}`)
      .id as string;
  }
  const report = (user: string, id: string, body: object = { reason: 'spam' }) =>
    request(app).post(`/api/chains/taco-bell/ratings/${id}/report`).set(as(user)).send(body);

  it('gives every review a public ID that isn’t the account ID', async () => {
    const id = await reviewBy('author');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(id).not.toContain('author');
  });

  it('needs a signed-in fan, a valid reason and an existing review', async () => {
    const id = await reviewBy('author');
    await request(app)
      .post(`/api/chains/taco-bell/ratings/${id}/report`)
      .send({ reason: 'spam' })
      .expect(401);
    await report('alice', id, { reason: 'boring' }).expect(400);
    await report('alice', 'no-such-review').expect(404);
  });

  it('records one report per fan, refuses self-reports, and emails the owner', async () => {
    const id = await reviewBy('author');
    await report('author', id).expect(400);
    await report('alice', id, { reason: 'spam', note: 'Advertising' }).expect(201, {
      hidden: false,
    });
    await report('alice', id).expect(409);

    expect(notifier.sent).toEqual([
      expect.objectContaining({
        chain: 'taco-bell',
        chainName: 'Taco Bell',
        reason: 'spam',
        note: 'Advertising',
        reportCount: 1,
        hidden: false,
      }),
    ]);
    expect(notifier.sent[0]!.rating.review).toContain('my-spam-site');
  });

  it('hides the text after three reports, keeps it hidden through edits, and still counts the forks', async () => {
    const id = await reviewBy('author');
    await report('a', id).expect(201, { hidden: false });
    await report('b', id).expect(201, { hidden: false });
    await report('c', id).expect(201, { hidden: true });

    const after = await request(app).get('/api/chains/taco-bell/ratings').expect(200);
    expect(after.body.ratings[0]).toEqual({
      id,
      displayName: 'Fan author',
      forks: 1,
      updatedAt: expect.any(String),
      hidden: true,
    });
    expect(after.body.audience.count).toBe(1);

    await rate('author', 'taco-bell', { forks: 2, review: 'Totally innocent now' }).expect(200);
    const edited = await request(app).get('/api/chains/taco-bell/ratings').expect(200);
    expect(edited.body.ratings[0]).toMatchObject({ id, hidden: true, forks: 2 });
    expect(edited.body.ratings[0]).not.toHaveProperty('review');
  });

  it('never reveals who reported', async () => {
    const id = await reviewBy('author');
    await report('secret-reporter', id).expect(201);
    const res = await request(app).get('/api/chains/taco-bell/ratings').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('secret-reporter');
    expect(JSON.stringify(notifier.sent)).not.toContain('secret-reporter');
  });

  it('deletes the reports a fan made when they delete their account', async () => {
    const id = await reviewBy('author');
    await signUp('alice', 'Alice');
    await report('alice', id).expect(201);
    await request(app).delete('/api/me').set(as('alice')).expect(204);
    expect(await reports.forReporter('alice')).toEqual([]);
  });

  it('gives older ratings without an ID one, once', async () => {
    await ratings.put({
      chain: 'taco-bell',
      userId: 'old',
      displayName: 'Old',
      forks: 3,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    });
    const first = await request(app).get('/api/chains/taco-bell/ratings').expect(200);
    const second = await request(app).get('/api/chains/taco-bell/ratings').expect(200);
    expect(first.body.ratings[0].id).toBeTruthy();
    expect(second.body.ratings[0].id).toBe(first.body.ratings[0].id);
  });
});
