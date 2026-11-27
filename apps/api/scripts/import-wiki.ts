/**
 * Imports every episode from the Doughboys Wikia, then classifies chains it hasn't seen.
 *
 *   npm run import:wiki                     # saves to apps/api/data/*.json (local dev)
 *   EPISODES_TABLE=... CHAINS_TABLE=... npm run import:wiki   # saves to DynamoDB
 *
 * Classification needs ANTHROPIC_API_KEY (or ANTHROPIC_KEY_PARAMETER); without it, chains
 * stay unclassified. In the cloud sandbox, Node's fetch needs NODE_USE_ENV_PROXY=1.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { InMemoryChainStore } from '../src/chains/memory.js';
import {
  chainStoreFromEnv,
  classifierFromEnv,
  localDataFile,
  storeFromEnv,
} from '../src/config.js';
import { InMemoryEpisodeStore } from '../src/stores/memory.js';
import { MediaWikiSource } from '../src/wiki/client.js';
import { importFromWiki } from '../src/wiki/import.js';

const store = storeFromEnv();
const chainStore = chainStoreFromEnv();

const result = await importFromWiki(new MediaWikiSource(), store, {
  store: chainStore,
  classifier: classifierFromEnv(),
});

function save(name: 'episodes' | 'chains', items: unknown[]) {
  mkdirSync(dirname(localDataFile(name)), { recursive: true });
  writeFileSync(localDataFile(name), JSON.stringify(items, null, 2) + '\n');
}
if (store instanceof InMemoryEpisodeStore) save('episodes', store.all());
if (chainStore instanceof InMemoryChainStore) save('chains', await chainStore.all());

console.log(
  `Imported ${result.episodes} episodes (${result.withRatings} with fork ratings, ` +
    `${result.withRestaurant} matched to a restaurant); classified ${result.classified} new chains.`,
);
if (result.classificationError)
  console.log(`Classification skipped: ${result.classificationError}`);
if (result.skipped.length)
  console.log(`Skipped ${result.skipped.length} pages without an infobox.`);
