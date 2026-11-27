import { describe, expect, it } from 'vitest';
import { chainLeaderboard, chainsInEpisodes } from './chains.js';
import type { ChainInfo, EpisodeSummary } from './episode.js';

const episode = (overrides: Partial<EpisodeSummary>): EpisodeSummary => ({
  slug: 'x',
  title: 'x',
  series: 'main',
  guests: [],
  wikiUrl: 'https://doughboys.fandom.com/wiki/x',
  ...overrides,
});

describe('chainLeaderboard', () => {
  it('averages rated visits, counts every visit, ranks best first', () => {
    const board = chainLeaderboard([
      episode({ slug: 'a1', restaurant: 'A', averageForks: 2, releaseDate: '2016-01-01' }),
      episode({ slug: 'a2', restaurant: 'A', averageForks: 3, releaseDate: '2020-01-01' }),
      episode({ slug: 'a3', restaurant: 'A', releaseDate: '2024-01-01' }), // unrated revisit
      episode({ slug: 'b', restaurant: 'B', averageForks: 4.5 }),
      episode({ slug: 'p', restaurant: 'Platinum', averageForks: 5.5 }),
      episode({ slug: 'c', restaurant: 'C' }), // never rated: left out
      episode({ slug: 'none', averageForks: 5 }), // no restaurant: left out
    ]);
    expect(board).toEqual([
      { name: 'Platinum', averageForks: 5.5, visits: 1, ratedVisits: 1, latestEpisode: 'p' },
      { name: 'B', averageForks: 4.5, visits: 1, ratedVisits: 1, latestEpisode: 'b' },
      { name: 'A', averageForks: 2.5, visits: 3, ratedVisits: 2, latestEpisode: 'a3' },
    ]);
  });

  it('adds category and website when known', () => {
    const info = new Map<string, ChainInfo>([
      ['Taco Bell', { name: 'Taco Bell', category: 'restaurant', domain: 'tacobell.com' }],
      ['Kiwi', { name: 'Kiwi', category: 'produce', domain: null }],
    ]);
    const board = chainLeaderboard(
      [
        episode({ restaurant: 'Taco Bell', averageForks: 4 }),
        episode({ restaurant: 'Kiwi', averageForks: 3 }),
      ],
      info,
    );
    expect(board[0]).toMatchObject({ category: 'restaurant', domain: 'tacobell.com' });
    expect(board[1]).toMatchObject({ category: 'produce' });
    expect(board[1]).not.toHaveProperty('domain');
  });
});

describe('chainsInEpisodes', () => {
  it('lists each restaurant with up to three episode titles', () => {
    const map = chainsInEpisodes(
      ['1', '2', '3', '4'].map((n) => episode({ title: `Ep ${n}`, restaurant: 'A' })),
    );
    expect(map.get('A')).toEqual(['Ep 1', 'Ep 2', 'Ep 3']);
  });
});
