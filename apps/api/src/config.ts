import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ChainInfo, Episode } from '@doughboys-app/shared';
import type { AppDeps } from './app.js';
import { apiKeyFromSsm, ClaudeChainClassifier } from './chains/claude.js';
import { DynamoChainStore } from './chains/dynamo.js';
import { InMemoryChainStore } from './chains/memory.js';
import type { ChainClassifier, ChainStore } from './chains/types.js';
import { CognitoAccountDirectory } from './fans/cognito.js';
import { DynamoProfileStore, DynamoRatingStore, DynamoReportStore } from './fans/dynamo.js';
import { SnsReportNotifier } from './fans/sns.js';
import {
  FakeAccountDirectory,
  FakeReportNotifier,
  InMemoryProfileStore,
  InMemoryRatingStore,
  InMemoryReportStore,
} from './fans/memory.js';
import { DynamoEpisodeStore } from './stores/dynamo.js';
import { InMemoryEpisodeStore } from './stores/memory.js';
import type { EpisodeStore } from './stores/types.js';

/**
 * Where `npm run import:wiki` saves data when there are no DynamoDB tables (local dev).
 * Relative to the working directory (npm runs workspace scripts in apps/api), not
 * `import.meta.url`, which doesn't exist in the CommonJS bundle Lambda runs.
 */
export const localDataFile = (name: 'episodes' | 'chains') =>
  resolve(process.cwd(), `data/${name}.json`);

function readLocal<T>(name: 'episodes' | 'chains'): T[] {
  const file = localDataFile(name);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T[]) : [];
}

/** DynamoDB in AWS (the CDK stack sets EPISODES_TABLE); otherwise the local snapshot, if any. */
export function storeFromEnv(env: NodeJS.ProcessEnv = process.env): EpisodeStore {
  if (env.EPISODES_TABLE) return new DynamoEpisodeStore(env.EPISODES_TABLE);
  return new InMemoryEpisodeStore(readLocal<Episode>('episodes'));
}

export function chainStoreFromEnv(env: NodeJS.ProcessEnv = process.env): ChainStore {
  if (env.CHAINS_TABLE) return new DynamoChainStore(env.CHAINS_TABLE);
  return new InMemoryChainStore(readLocal<ChainInfo>('chains'));
}

/** In AWS the key is in SSM Parameter Store; locally it can be an environment variable. */
export function classifierFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ChainClassifier | undefined {
  if (env.ANTHROPIC_KEY_PARAMETER) {
    return new ClaudeChainClassifier(apiKeyFromSsm(env.ANTHROPIC_KEY_PARAMETER));
  }
  const apiKey = env.ANTHROPIC_API_KEY;
  return apiKey ? new ClaudeChainClassifier(async () => apiKey) : undefined;
}

export function depsFromEnv(env: NodeJS.ProcessEnv = process.env): AppDeps {
  return {
    store: storeFromEnv(env),
    chainStore: chainStoreFromEnv(env),
    // Fans' data lives in DynamoDB in AWS; locally it's in memory and lost on restart.
    ratingStore: env.RATINGS_TABLE
      ? new DynamoRatingStore(env.RATINGS_TABLE)
      : new InMemoryRatingStore(),
    profileStore: env.PROFILES_TABLE
      ? new DynamoProfileStore(env.PROFILES_TABLE)
      : new InMemoryProfileStore(),
    reportStore: env.REPORTS_TABLE
      ? new DynamoReportStore(env.REPORTS_TABLE)
      : new InMemoryReportStore(),
    // Without an alerts topic (no ALERT_EMAIL), reports are still saved, just not emailed.
    notifier: env.ALERTS_TOPIC_ARN
      ? new SnsReportNotifier(env.ALERTS_TOPIC_ARN)
      : new FakeReportNotifier(),
    accounts: env.USER_POOL_ID
      ? new CognitoAccountDirectory(env.USER_POOL_ID)
      : new FakeAccountDirectory(),
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : undefined,
  };
}
