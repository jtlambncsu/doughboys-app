import { defineConfig } from 'tsup';

export default defineConfig({
  // The HTTP API, and the scheduled job that refreshes data from the wiki.
  entry: ['src/index.ts', 'src/lambda.ts', 'src/importLambda.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  // Bundle the shared workspace package (it ships TypeScript source, not JS).
  noExternal: ['@doughboys-app/shared'],
});
