import { chainStoreFromEnv, classifierFromEnv, storeFromEnv } from './config.js';
import { MediaWikiSource } from './wiki/client.js';
import { importFromWiki } from './wiki/import.js';

/** Runs on a weekly schedule (see infra) to pick up new episodes and wiki edits. */
export async function handler() {
  const result = await importFromWiki(new MediaWikiSource(), storeFromEnv(), {
    store: chainStoreFromEnv(),
    classifier: classifierFromEnv(),
  });
  console.log(JSON.stringify({ ...result, skipped: result.skipped.length }));
  return result;
}
