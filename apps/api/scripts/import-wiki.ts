/**
 * Imports every episode from the Doughboys Wikia.
 *
 *   npm run import:wiki                     # saves to apps/api/data/episodes.json (local dev)
 *   EPISODES_TABLE=... npm run import:wiki  # saves to that DynamoDB table
 *
 * In the cloud sandbox, Node's fetch needs NODE_USE_ENV_PROXY=1 to reach the wiki.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DynamoEpisodeStore } from '../src/stores/dynamo.js';
import { InMemoryEpisodeStore } from '../src/stores/memory.js';
import { localDataFile } from '../src/config.js';
import { MediaWikiSource } from '../src/wiki/client.js';
import { importFromWiki } from '../src/wiki/import.js';

const table = process.env.EPISODES_TABLE;
const store = table ? new DynamoEpisodeStore(table) : new InMemoryEpisodeStore();

const result = await importFromWiki(new MediaWikiSource(), store);

if (store instanceof InMemoryEpisodeStore) {
  mkdirSync(dirname(localDataFile()), { recursive: true });
  writeFileSync(localDataFile(), JSON.stringify(store.all(), null, 2) + '\n');
}

console.log(
  `Imported ${result.episodes} episodes (${result.withRatings} with fork ratings, ` +
    `${result.withRestaurant} matched to a restaurant) into ${table ?? 'data/episodes.json'}.`,
);
if (result.skipped.length)
  console.log(`Skipped ${result.skipped.length} pages without an infobox.`);
