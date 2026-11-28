import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  paginateQuery,
  paginateScan,
  PutCommand,
  UpdateCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type {
  ProfileStore,
  RatingStore,
  ReportStore,
  StoredProfile,
  StoredRating,
  StoredReport,
} from './types.js';

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

  async addReport(chain: string, userId: string) {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { chain, userId },
        UpdateExpression: 'ADD reportCount :one',
        ConditionExpression: 'attribute_exists(chain)', // don't create a rating by reporting it
        ExpressionAttributeValues: { ':one': 1 },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    return Number(result.Attributes?.reportCount ?? 0);
  }

  async hide(chain: string, userId: string) {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { chain, userId },
        UpdateExpression: 'SET hidden = :true',
        ConditionExpression: 'attribute_exists(chain)',
        ExpressionAttributeValues: { ':true': true },
      }),
    );
  }
}

/** Reports keyed by (ratingId, reporterId), with a `byReporter` index for account deletion. */
export class DynamoReportStore implements ReportStore {
  constructor(
    private readonly tableName: string,
    private readonly client = documentClient(),
  ) {}

  async add(report: StoredReport) {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: report,
          // One report per fan per review, enforced by the database.
          ConditionExpression: 'attribute_not_exists(ratingId)',
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }

  async forReporter(reporterId: string) {
    const items: StoredReport[] = [];
    for await (const page of paginateQuery(
      { client: this.client },
      {
        TableName: this.tableName,
        IndexName: 'byReporter',
        KeyConditionExpression: 'reporterId = :r',
        ExpressionAttributeValues: { ':r': reporterId },
      },
    )) {
      items.push(...((page.Items ?? []) as StoredReport[]));
    }
    return items;
  }

  async delete(ratingId: string, reporterId: string) {
    await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { ratingId, reporterId } }),
    );
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
