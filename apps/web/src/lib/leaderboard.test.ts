import { describe, expect, it } from 'vitest';
import type { Chain } from '@doughboys-app/shared';
import { rankChains } from './leaderboard';

const chain = (
  name: string,
  averageForks: number,
  visits: number,
  category?: Chain['category'],
): Chain => ({
  name,
  averageForks,
  visits,
  ratedVisits: visits,
  latestEpisode: name,
  ...(category && { category }),
});

const chains = [
  chain('Zankou', 5.67, 1, 'restaurant'),
  chain('Albertsons', 4, 2, 'grocery'),
  chain('Taco Bell', 3.9, 8, 'restaurant'),
  chain('Mystery', 3, 1), // not classified yet
];

describe('rankChains', () => {
  it('shows restaurants (and unclassified chains) by rating, ranked within the view', () => {
    expect(rankChains(chains, 'restaurants', 'rating').map((c) => [c.rank, c.name])).toEqual([
      [1, 'Zankou'],
      [2, 'Taco Bell'],
      [3, 'Mystery'],
    ]);
  });

  it('can include everything and sort by visits', () => {
    expect(rankChains(chains, 'all', 'visits').map((c) => c.name)).toEqual([
      'Taco Bell',
      'Albertsons',
      'Zankou',
      'Mystery',
    ]);
  });
});
