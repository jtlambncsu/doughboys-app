import { chainsInEpisodes, type Episode } from '@doughboys-app/shared';
import type { ChainClassifier, ChainStore } from '../chains/types.js';
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
  /** Chains classified this run (new ones only). */
  classified: number;
  /** Why classification didn't run or failed, if it didn't complete. */
  classificationError?: string;
}

export interface ChainDeps {
  store: ChainStore;
  /** Omit when there's no Anthropic key (local dev): chains stay unclassified. */
  classifier?: ChainClassifier;
}

/** Reads every episode from the wiki and saves it. Safe to re-run: each episode is replaced. */
export async function importFromWiki(
  wiki: WikiSource,
  store: EpisodeStore,
  chains?: ChainDeps,
): Promise<ImportResult> {
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

  // Related links can point at pages that aren't episodes (or don't exist); drop those.
  const known = new Set(episodes.map((e) => e.slug));
  for (const episode of episodes) {
    if (episode.details) {
      episode.details.related = episode.details.related.filter((slug) => known.has(slug));
    }
  }

  await store.putEpisodes(episodes);
  const classification = chains ? await classifyNewChains(episodes, chains) : { classified: 0 };
  return {
    ...classification,
    episodes: episodes.length,
    withRatings: episodes.filter((e) => e.averageForks !== undefined).length,
    withRestaurant: episodes.filter((e) => e.restaurant).length,
    skipped,
  };
}

/**
 * Classifies chains seen for the first time. Episodes are already saved, so a failure here
 * (no key, API down) only delays categories and logos until the next run.
 */
async function classifyNewChains(
  episodes: Episode[],
  { store, classifier }: ChainDeps,
): Promise<{ classified: number; classificationError?: string }> {
  if (!classifier) return { classified: 0, classificationError: 'no classifier configured' };
  const known = new Set((await store.all()).map((chain) => chain.name));
  const fresh = [...chainsInEpisodes(episodes)]
    .filter(([name]) => !known.has(name))
    .map(([name, episodeTitles]) => ({ name, episodeTitles }));
  if (fresh.length === 0) return { classified: 0 };
  try {
    const classified = await classifier.classify(fresh);
    await store.put(classified);
    return { classified: classified.length };
  } catch (error) {
    console.error('Chain classification failed', error);
    return { classified: 0, classificationError: String(error) };
  }
}
