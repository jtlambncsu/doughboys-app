import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Episode } from '@doughboys-app/shared';
import type { AppDeps } from './app.js';
import { DynamoEpisodeStore } from './stores/dynamo.js';
import { InMemoryEpisodeStore } from './stores/memory.js';
import type { EpisodeStore } from './stores/types.js';

/**
 * Where `npm run import:wiki` saves episodes when there's no DynamoDB table (local dev).
 * Relative to the working directory (npm runs workspace scripts in apps/api), not
 * `import.meta.url`, which doesn't exist in the CommonJS bundle Lambda runs.
 */
export const localDataFile = () => resolve(process.cwd(), 'data/episodes.json');

/** DynamoDB in AWS (the CDK stack sets EPISODES_TABLE); otherwise the local snapshot, if any. */
export function storeFromEnv(env: NodeJS.ProcessEnv = process.env): EpisodeStore {
  if (env.EPISODES_TABLE) return new DynamoEpisodeStore(env.EPISODES_TABLE);
  const file = localDataFile();
  const episodes = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Episode[]) : [];
  return new InMemoryEpisodeStore(episodes);
}

export function depsFromEnv(env: NodeJS.ProcessEnv = process.env): AppDeps {
  return {
    store: storeFromEnv(env),
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : undefined,
  };
}
