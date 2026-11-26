import { describe, expect, it } from 'vitest';
import { chainLeaderboard } from './chains.js';
import type { EpisodeSummary } from './episode.js';

const episode = (overrides: Partial<EpisodeSummary>): EpisodeSummary => ({
  slug: 'x',
  title: 'x',
  series: 'main',
  guests: [],
  wikiUrl: 'https://doughboys.fandom.com/wiki/x',
  ...overrides,
});

describe('chainLeaderboard', () => {
  it('averages repeat visits, ranks best first and skips unrated episodes', () => {
    const board = chainLeaderboard([
      episode({ slug: 'a1', restaurant: 'A', averageForks: 2, releaseDate: '2016-01-01' }),
      episode({ slug: 'a2', restaurant: 'A', averageForks: 3, releaseDate: '2020-01-01' }),
      episode({ slug: 'b', restaurant: 'B', averageForks: 4.5 }),
      episode({ slug: 'p', restaurant: 'Platinum', averageForks: 5.5 }),
      episode({ slug: 'c', restaurant: 'C' }),
      episode({ slug: 'none', averageForks: 5 }),
    ]);
    expect(board).toEqual([
      { name: 'Platinum', averageForks: 5.5, episodeCount: 1, latestEpisode: 'p' },
      { name: 'B', averageForks: 4.5, episodeCount: 1, latestEpisode: 'b' },
      { name: 'A', averageForks: 2.5, episodeCount: 2, latestEpisode: 'a2' },
    ]);
  });
});
