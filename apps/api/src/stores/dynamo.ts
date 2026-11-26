import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  paginateScan,
} from '@aws-sdk/lib-dynamodb';
import type { Episode } from '@doughboys-app/shared';
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
    // BatchWrite takes 25 items at a time and may hand some back to retry when throttled.
    for (let i = 0; i < episodes.length; i += 25) {
      let requests: { PutRequest: { Item: Record<string, unknown> } }[] | undefined = episodes
        .slice(i, i + 25)
        .map((episode) => ({ PutRequest: { Item: episode } }));
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
    const episodes: Episode[] = [];
    for await (const page of paginateScan({ client: this.client }, { TableName: this.tableName })) {
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
}
