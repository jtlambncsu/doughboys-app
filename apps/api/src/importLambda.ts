import { chainStoreFromEnv, classifierFromEnv, storeFromEnv } from './config.js';
import { PodcastFeedSource } from './feed/feed.js';
import { MediaWikiSource } from './wiki/client.js';
import { importFromWiki } from './wiki/import.js';

/** Runs daily (see infra) to pick up new episodes from the feed and edits on the wiki. */
export async function handler() {
  const result = await importFromWiki(
    new MediaWikiSource(),
    storeFromEnv(),
    { store: chainStoreFromEnv(), classifier: classifierFromEnv() },
    new PodcastFeedSource(),
  );
  console.log(JSON.stringify({ ...result, skipped: result.skipped.length }));
  return result;
}
