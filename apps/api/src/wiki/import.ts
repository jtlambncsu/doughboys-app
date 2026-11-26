import type { Episode } from '@doughboys-app/shared';
import type { EpisodeStore } from '../stores/types.js';
import type { WikiSource } from './client.js';
import {
  normalizeTitle,
  parseEpisodePage,
  parseRestaurantsPage,
  type RestaurantEntry,
} from './parse.js';

export interface ImportResult {
  episodes: number;
  withRatings: number;
  withRestaurant: number;
  skipped: string[];
}

/** Reads every episode from the wiki and saves it. Safe to re-run: each episode is replaced. */
export async function importFromWiki(wiki: WikiSource, store: EpisodeStore): Promise<ImportResult> {
  const restaurantsPage = await wiki.page('Restaurants');
  const restaurants = restaurantsPage
    ? parseRestaurantsPage(restaurantsPage.wikitext)
    : new Map<string, RestaurantEntry>();

  const episodes: Episode[] = [];
  const skipped: string[] = [];
  for await (const page of wiki.episodePages()) {
    const episode = parseEpisodePage(page.title, page.wikitext);
    if (!episode) {
      skipped.push(page.title);
      continue;
    }
    const entry = restaurants.get(normalizeTitle(page.title));
    episodes.push({
      ...episode,
      ...(entry && { restaurant: entry.restaurant }),
      ...(entry?.rating !== undefined && { averageForks: entry.rating }),
    });
  }

  await store.putEpisodes(episodes);
  return {
    episodes: episodes.length,
    withRatings: episodes.filter((e) => e.averageForks !== undefined).length,
    withRestaurant: episodes.filter((e) => e.restaurant).length,
    skipped,
  };
}
