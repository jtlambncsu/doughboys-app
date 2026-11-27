import { chainSlug, chainsInEpisodes, type Episode } from '@doughboys-app/shared';
import type { ChainClassifier, ChainStore } from '../chains/types.js';
import { episodeFromFeed, type FeedSource } from '../feed/feed.js';
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
  /** New episodes added from the podcast feed because the wiki doesn't have them yet. */
  fromFeed: number;
  /** Feed-only episodes removed because the wiki covers them now. */
  replacedFeedEpisodes: number;
  feedError?: string;
}

export interface ChainDeps {
  store: ChainStore;
  /** Omit when there's no Anthropic key (local dev): chains stay unclassified. */
  classifier?: ChainClassifier;
}

/**
 * Reads every episode from the wiki, adds numbered episodes from the podcast feed that the
 * wiki hasn't covered yet, and saves them. Safe to re-run: each episode is replaced, and
 * feed-only episodes are removed once the wiki has them.
 */
export async function importFromWiki(
  wiki: WikiSource,
  store: EpisodeStore,
  chains?: ChainDeps,
  feed?: FeedSource,
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

  const fromFeed = feed ? await newFromFeed(feed, episodes) : { added: [] };
  episodes.push(...fromFeed.added);

  // Feed-only episodes from earlier runs that the wiki now covers (under its own title).
  const current = new Set(episodes.map((e) => e.slug));
  const stale = (await store.listEpisodes())
    .filter((e) => e.source === 'feed' && !current.has(e.slug))
    .map((e) => e.slug);

  await store.putEpisodes(episodes);
  if (stale.length) await store.deleteEpisodes(stale);
  const classification = chains ? await classifyNewChains(episodes, chains) : { classified: 0 };
  return {
    ...classification,
    episodes: episodes.length,
    withRatings: episodes.filter((e) => e.averageForks !== undefined).length,
    withRestaurant: episodes.filter((e) => e.restaurant).length,
    skipped,
    fromFeed: fromFeed.added.length,
    replacedFeedEpisodes: stale.length,
    ...('error' in fromFeed && { feedError: fromFeed.error }),
  };
}

/**
 * Main-show episodes in the feed whose number the wiki doesn't have yet. A feed failure is
 * logged and skipped: the wiki data still gets saved.
 */
async function newFromFeed(
  feed: FeedSource,
  wikiEpisodes: Episode[],
): Promise<{ added: Episode[]; error?: string }> {
  try {
    const items = await feed.episodes();
    const numbers = new Set(wikiEpisodes.filter((e) => e.series === 'main').map((e) => e.number));
    const slugs = new Set(wikiEpisodes.map((e) => e.slug));
    const knownChains = new Map(
      wikiEpisodes.flatMap((e) => (e.restaurant ? [[chainSlug(e.restaurant), e.restaurant]] : [])),
    ) as Map<string, string>;
    const added = items
      .filter((item) => !numbers.has(item.number))
      .map((item) => episodeFromFeed(item, knownChains))
      .filter((episode) => !slugs.has(episode.slug));
    return { added };
  } catch (error) {
    console.error('Podcast feed failed', error);
    return { added: [], error: String(error) };
  }
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
