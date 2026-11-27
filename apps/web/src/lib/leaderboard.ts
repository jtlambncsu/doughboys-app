import type { Chain } from '@doughboys-app/shared';

export type Show = 'restaurants' | 'all';
export type Sort = 'rating' | 'visits';

/** Products reviewed from a store shelf or a field, rather than a place you go to eat. */
const PRODUCTS = new Set<Chain['category']>(['packaged_food', 'produce', 'drink']);

/**
 * The "Restaurants" view: anywhere they went to eat, including grocery stores, gas stations
 * and one-offs (IKEA, a wrestling show's catering). Only products are left out. Unclassified
 * chains count too, so the view is never empty.
 */
export function isRestaurant(chain: Chain) {
  return !PRODUCTS.has(chain.category);
}

/** Filters and orders the board, numbering ranks within the chosen view. */
export function rankChains(chains: Chain[], show: Show, sort: Sort) {
  const visible = show === 'restaurants' ? chains.filter(isRestaurant) : [...chains];
  if (sort === 'visits') {
    visible.sort(
      (a, b) =>
        b.visits - a.visits || b.averageForks - a.averageForks || a.name.localeCompare(b.name),
    );
  }
  // The API already sorts by rating.
  return visible.map((chain, index) => ({ ...chain, rank: index + 1 }));
}

export function visitsLabel(visits: number) {
  return visits === 1 ? '1 visit' : `${visits} visits`;
}
