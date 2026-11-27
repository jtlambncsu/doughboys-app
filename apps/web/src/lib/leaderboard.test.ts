import { describe, expect, it } from 'vitest';
import type { Chain } from '@doughboys-app/shared';
import { rankChains } from './leaderboard';

const chain = (
  name: string,
  averageForks: number,
  visits: number,
  category?: Chain['category'],
): Chain => ({
  slug: name.toLowerCase(),
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
  chain('Tombstone Pizza', 4.2, 1, 'packaged_food'),
  chain('Mangos', 4.1, 1, 'produce'),
  chain('Taco Bell', 3.9, 8, 'restaurant'),
  chain('Mystery', 3, 1), // not classified yet
];

describe('rankChains', () => {
  it('shows places (stores and unclassified chains too) but not products, ranked within the view', () => {
    expect(rankChains(chains, 'restaurants', 'rating').map((c) => [c.rank, c.name])).toEqual([
      [1, 'Zankou'],
      [2, 'Albertsons'],
      [3, 'Taco Bell'],
      [4, 'Mystery'],
    ]);
  });

  it('can include everything and sort by visits', () => {
    expect(rankChains(chains, 'all', 'visits').map((c) => c.name)).toEqual([
      'Taco Bell',
      'Albertsons',
      'Zankou',
      'Tombstone Pizza',
      'Mangos',
      'Mystery',
    ]);
  });
});
