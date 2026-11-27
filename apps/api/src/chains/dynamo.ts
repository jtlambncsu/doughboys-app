import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient, paginateScan } from '@aws-sdk/lib-dynamodb';
import type { ChainInfo } from '@doughboys-app/shared';
import type { ChainStore } from './types.js';

/** Classified chains in a DynamoDB table keyed by `name`. A few hundred items. */
export class DynamoChainStore implements ChainStore {
  constructor(
    private readonly tableName: string,
    private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {}

  async all() {
    const chains: ChainInfo[] = [];
    for await (const page of paginateScan({ client: this.client }, { TableName: this.tableName })) {
      chains.push(...((page.Items ?? []) as ChainInfo[]));
    }
    return chains;
  }

  async put(chains: ChainInfo[]) {
    for (let i = 0; i < chains.length; i += 25) {
      let requests: { PutRequest: { Item: Record<string, unknown> } }[] | undefined = chains
        .slice(i, i + 25)
        .map((chain) => ({ PutRequest: { Item: chain } }));
      for (let attempt = 0; requests?.length; attempt++) {
        if (attempt > 5) throw new Error('DynamoDB kept throttling chain writes');
        if (attempt) await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        const result = await this.client.send(
          new BatchWriteCommand({ RequestItems: { [this.tableName]: requests } }),
        );
        requests = result.UnprocessedItems?.[this.tableName] as typeof requests;
      }
    }
  }
}
