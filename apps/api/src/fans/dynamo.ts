import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  paginateQuery,
  paginateScan,
  PutCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type { ProfileStore, RatingStore, StoredProfile, StoredRating } from './types.js';

const documentClient = () =>
  DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

/** Ratings keyed by (chain, userId), with a `byUser` index keyed by (userId, chain). */
export class DynamoRatingStore implements RatingStore {
  constructor(
    private readonly tableName: string,
    private readonly client = documentClient(),
  ) {}

  async put(rating: StoredRating) {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: rating }));
  }

  async get(chain: string, userId: string) {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { chain, userId } }),
    );
    return result.Item as StoredRating | undefined;
  }

  async delete(chain: string, userId: string) {
    await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { chain, userId } }),
    );
  }

  private async query(input: Omit<QueryCommandInput, 'TableName'>) {
    const items: StoredRating[] = [];
    for await (const page of paginateQuery(
      { client: this.client },
      { TableName: this.tableName, ...input },
    )) {
      items.push(...((page.Items ?? []) as StoredRating[]));
    }
    return items;
  }

  forChain(chain: string) {
    return this.query({
      KeyConditionExpression: 'chain = :chain',
      ExpressionAttributeValues: { ':chain': chain },
    });
  }

  forUser(userId: string) {
    return this.query({
      IndexName: 'byUser',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    });
  }

  async all() {
    const items: StoredRating[] = [];
    for await (const page of paginateScan({ client: this.client }, { TableName: this.tableName })) {
      items.push(...((page.Items ?? []) as StoredRating[]));
    }
    return items;
  }
}

export class DynamoProfileStore implements ProfileStore {
  constructor(
    private readonly tableName: string,
    private readonly client = documentClient(),
  ) {}

  async get(userId: string) {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { userId } }),
    );
    return result.Item as StoredProfile | undefined;
  }

  async put(profile: StoredProfile) {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: profile }));
  }

  async delete(userId: string) {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: { userId } }));
  }
}
