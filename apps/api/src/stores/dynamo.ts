import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  type BatchGetCommandOutput,
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  paginateScan,
} from '@aws-sdk/lib-dynamodb';
import type { Episode } from '@doughboys-app/shared';

type WriteRequest =
  | { PutRequest: { Item: Record<string, unknown> } }
  | { DeleteRequest: { Key: Record<string, unknown> } };
import { newestFirst, toSummary, type EpisodeStore } from './types.js';

/** Episodes in one DynamoDB table keyed by `slug`. See docs/decisions/0003. */
export class DynamoEpisodeStore implements EpisodeStore {
  constructor(
    private readonly tableName: string,
    private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {}

  async putEpisodes(episodes: Episode[]) {
    await this.batchWrite(episodes.map((episode) => ({ PutRequest: { Item: episode } })));
  }

  async deleteEpisodes(slugs: string[]) {
    await this.batchWrite(slugs.map((slug) => ({ DeleteRequest: { Key: { slug } } })));
  }

  private async batchWrite(all: WriteRequest[]) {
    // BatchWrite takes 25 requests at a time and may hand some back to retry when throttled.
    for (let i = 0; i < all.length; i += 25) {
      let requests: WriteRequest[] | undefined = all.slice(i, i + 25);
      for (let attempt = 0; requests?.length; attempt++) {
        if (attempt > 5) throw new Error('DynamoDB kept throttling the import');
        if (attempt) await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        const result = await this.client.send(
          new BatchWriteCommand({ RequestItems: { [this.tableName]: requests } }),
        );
        requests = result.UnprocessedItems?.[this.tableName] as typeof requests;
      }
    }
  }

  async listEpisodes() {
    // About a thousand items, so a full scan is fine; it's cached by the route.
    // Read only the list fields, not ratings or page details (most of each item's size).
    const fields = [
      'slug',
      'title',
      'number',
      'series',
      'releaseDate',
      'restaurant',
      'guests',
      'averageForks',
      'wikiUrl',
      'source',
    ];
    const episodes: Episode[] = [];
    for await (const page of paginateScan(
      { client: this.client },
      {
        TableName: this.tableName,
        ProjectionExpression: fields.map((_, i) => `#f${i}`).join(', '),
        // Placeholders, because some field names (like "number") are DynamoDB reserved words.
        ExpressionAttributeNames: Object.fromEntries(fields.map((f, i) => [`#f${i}`, f])),
      },
    )) {
      episodes.push(...((page.Items ?? []) as Episode[]));
    }
    return episodes.map(toSummary).sort(newestFirst);
  }

  async getEpisode(slug: string) {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { slug } }),
    );
    return result.Item as Episode | undefined;
  }

  async getEpisodes(slugs: string[]) {
    // BatchGet takes 100 keys at a time and may hand some back to retry when throttled.
    const episodes: Episode[] = [];
    for (let i = 0; i < slugs.length; i += 100) {
      let keys: Record<string, unknown>[] | undefined = slugs
        .slice(i, i + 100)
        .map((slug) => ({ slug }));
      for (let attempt = 0; keys?.length; attempt++) {
        if (attempt > 5) throw new Error('DynamoDB kept throttling a batch read');
        if (attempt) await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        const result: BatchGetCommandOutput = await this.client.send(
          new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: keys } } }),
        );
        episodes.push(...((result.Responses?.[this.tableName] ?? []) as Episode[]));
        keys = result.UnprocessedKeys?.[this.tableName]?.Keys;
      }
    }
    return episodes;
  }
}
