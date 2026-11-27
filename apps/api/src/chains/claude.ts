import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { z } from 'zod';
import { chainCategorySchema, type ChainInfo } from '@doughboys-app/shared';
import type { ChainClassifier, ChainToClassify } from './types.js';

const MODEL = 'claude-opus-5-5';

/** Chains per request: small enough to answer reliably, big enough to keep calls few. */
const BATCH_SIZE = 40;
/** Requests in flight at once during the first import (~400 chains, ~10 requests). */
const CONCURRENCY = 3;

const SYSTEM_PROMPT = `You classify places reviewed on Doughboys, a comedy podcast where the hosts review chain restaurants (and occasionally grocery stores, packaged foods, produce and drinks). For each name you get, with the titles of episodes it appeared in, return:

- category: "restaurant" for anywhere you sit down or order prepared food, including fast food, cafés, bakeries, dessert and coffee shops, food courts, theme-park and stadium food, and venue catering; "grocery" for supermarkets and convenience stores; "packaged_food" for brands of snacks, frozen meals and other store-bought food; "produce" for fruits and vegetables; "drink" for beverage brands or machines; "other" for anything else.
- domain: the official website of that brand or chain, as a bare domain like "tacobell.com" (no "https://", no "www.", no path). Use the brand's main site for the country it's best known in. Use null if you aren't confident it exists, for a single local restaurant whose site you don't know, or for produce.

Return exactly one entry per name you were given, with the name copied exactly.`;

const resultSchema = z.object({
  chains: z.array(
    z.object({
      name: z.string(),
      category: chainCategorySchema,
      domain: z.string().nullable(),
    }),
  ),
});

/** "https://www.TacoBell.com/menu" → "tacobell.com"; junk → null. */
export function cleanDomain(value: string | null): string | null {
  if (!value) return null;
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0];
  return host && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
}

export class ClassificationError extends Error {}

/** Labels chains with Claude, using structured outputs so the answer always fits the schema. */
export class ClaudeChainClassifier implements ChainClassifier {
  private client?: Promise<Anthropic>;

  /**
   * @param getApiKey Loads the key on first use (e.g. from SSM).
   * @param clientOptions Extra SDK options (tests pass a fake `fetch`).
   */
  constructor(
    private readonly getApiKey: () => Promise<string>,
    private readonly clientOptions: ClientOptions = {},
  ) {}

  private getClient() {
    this.client ??= this.getApiKey().then(
      (apiKey) => new Anthropic({ maxRetries: 3, ...this.clientOptions, apiKey }),
    );
    this.client.catch(() => (this.client = undefined));
    return this.client;
  }

  async classify(chains: ChainToClassify[]): Promise<ChainInfo[]> {
    const batches: ChainToClassify[][] = [];
    for (let i = 0; i < chains.length; i += BATCH_SIZE)
      batches.push(chains.slice(i, i + BATCH_SIZE));

    const results: ChainInfo[] = [];
    // A small worker pool: a few batches at a time, so the first import doesn't take minutes.
    const queue = [...batches];
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (let batch = queue.shift(); batch; batch = queue.shift()) {
          results.push(...(await this.classifyBatch(batch)));
        }
      }),
    );
    return results;
  }

  private async classifyBatch(batch: ChainToClassify[]): Promise<ChainInfo[]> {
    const client = await this.getClient();
    const list = batch
      .map((chain) => `- ${chain.name} (episodes: ${chain.episodeTitles.join('; ')})`)
      .join('\n');
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // A simple labelling task: low effort is plenty, and keeps it quick and cheap.
      output_config: { effort: 'low', format: betaZodOutputFormat(resultSchema) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: list }],
    });

    const output = response.parsed_output;
    if (response.stop_reason === 'refusal' || !output) {
      throw new ClassificationError(`No classification (stop reason: ${response.stop_reason})`);
    }
    // Keep only names we asked about, so a misspelled echo can't create a phantom chain.
    const asked = new Set(batch.map((chain) => chain.name));
    const answered = new Set(output.chains.map((chain) => chain.name));
    const missing = [...asked].filter((name) => !answered.has(name));
    if (missing.length) {
      // They'll be asked about again on the next import.
      console.warn(`Claude returned no match for: ${missing.join(', ')}`);
    }
    return output.chains
      .filter((chain) => asked.has(chain.name))
      .map((chain) => ({ ...chain, domain: cleanDomain(chain.domain) }));
  }
}

/** Reads the Anthropic key from SSM Parameter Store (a SecureString), trimming stray spaces. */
export function apiKeyFromSsm(name: string, ssm: Pick<SSMClient, 'send'> = new SSMClient({})) {
  return async () => {
    const result = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    const key = result.Parameter?.Value?.trim();
    if (!key) throw new ClassificationError(`SSM parameter ${name} is empty`);
    return key;
  };
}
