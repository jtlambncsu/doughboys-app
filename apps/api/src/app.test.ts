import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Episode } from '@doughboys-app/shared';
import { createApp } from './app.js';
import { InMemoryChainStore } from './chains/memory.js';
import { InMemoryEpisodeStore } from './stores/memory.js';

const episode = (overrides: Partial<Episode> & { slug: string }): Episode => ({
  title: overrides.slug,
  series: 'main',
  guests: [],
  ratings: [],
  wikiUrl: `https://doughboys.fandom.com/wiki/${overrides.slug}`,
  ...overrides,
});

const store = new InMemoryEpisodeStore([
  episode({
    slug: 'IHOP with Alison Agosti',
    restaurant: 'IHOP',
    releaseDate: '2015-05-28',
    averageForks: 3.83,
    ratings: [
      { person: 'Nick Wiger', forks: 4, unit: 'forks', raw: '4 forks', ordered: ['Coffee'] },
    ],
  }),
  episode({
    slug: 'Taco Bell with Jack Allison',
    restaurant: 'Taco Bell',
    releaseDate: '2015-05-14',
    averageForks: 4,
  }),
]);
const chainStore = new InMemoryChainStore([
  { name: 'Taco Bell', category: 'restaurant', domain: 'tacobell.com' },
]);
const app = createApp({ store, chainStore, cacheMs: 0 });

describe('API', () => {
  it('reports health', async () => {
    await request(app).get('/api/health').expect(200, { status: 'ok' });
  });

  it('lists episodes newest first, without orders', async () => {
    const res = await request(app).get('/api/episodes').expect(200);
    expect(res.body.map((e: Episode) => e.slug)).toEqual([
      'IHOP with Alison Agosti',
      'Taco Bell with Jack Allison',
    ]);
    expect(res.body[0]).not.toHaveProperty('ratings');
  });

  it('gets one episode by its URL-encoded slug', async () => {
    const res = await request(app)
      .get(`/api/episodes/${encodeURIComponent('IHOP with Alison Agosti')}`)
      .expect(200);
    expect(res.body.ratings[0]).toMatchObject({ person: 'Nick Wiger', forks: 4 });
  });

  it('404s for an unknown episode or route', async () => {
    await request(app).get('/api/episodes/nope').expect(404);
    await request(app).get('/api/nope').expect(404);
  });

  it('ranks chains', async () => {
    const res = await request(app).get('/api/chains').expect(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual(['Taco Bell', 'IHOP']);
    expect(res.body[0]).toMatchObject({
      category: 'restaurant',
      domain: 'tacobell.com',
      visits: 1,
    });
    expect(res.body[1]).not.toHaveProperty('category'); // not classified yet
  });
});
