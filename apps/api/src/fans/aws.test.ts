import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { CognitoAccountDirectory } from './cognito.js';
import { DynamoRatingStore, DynamoReportStore } from './dynamo.js';
import { SnsReportNotifier } from './sns.js';

const ddb = mockClient(DynamoDBDocumentClient);
const cognito = mockClient(CognitoIdentityProviderClient);
const sns = mockClient(SNSClient);

beforeEach(() => {
  ddb.reset();
  cognito.reset();
  sns.reset();
});

describe('DynamoRatingStore', () => {
  const store = new DynamoRatingStore(
    'Ratings',
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
  );

  it('reads a chain’s ratings by key and a fan’s through the byUser index', async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    await store.forChain('taco-bell');
    await store.forUser('alice');
    const [chain, user] = ddb.commandCalls(QueryCommand).map((c) => c.args[0].input);
    expect(chain).toMatchObject({ ExpressionAttributeValues: { ':chain': 'taco-bell' } });
    expect(chain).not.toHaveProperty('IndexName');
    expect(user).toMatchObject({
      IndexName: 'byUser',
      ExpressionAttributeValues: { ':userId': 'alice' },
    });
  });
});

describe('CognitoAccountDirectory', () => {
  const directory = new CognitoAccountDirectory('pool-1', new CognitoIdentityProviderClient({}));

  it('deletes the user by their sub', async () => {
    cognito.on(AdminDeleteUserCommand).resolves({});
    await directory.deleteAccount('sub-123');
    expect(cognito.commandCalls(AdminDeleteUserCommand)[0]!.args[0].input).toEqual({
      UserPoolId: 'pool-1',
      Username: 'sub-123',
    });
  });

  it('treats an already deleted account as done', async () => {
    cognito
      .on(AdminDeleteUserCommand)
      .rejects(new UserNotFoundException({ message: 'gone', $metadata: {} }));
    await expect(directory.deleteAccount('sub-123')).resolves.toBeUndefined();
  });
});

describe('DynamoReportStore', () => {
  const store = new DynamoReportStore(
    'Reports',
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
  );
  const report = {
    ratingId: 'r1',
    reporterId: 'u1',
    chain: 'taco-bell',
    reason: 'spam',
    createdAt: 'now',
  };

  it('lets the database refuse a second report from the same fan', async () => {
    ddb
      .on(PutCommand)
      .resolvesOnce({})
      .rejects(new ConditionalCheckFailedException({ message: 'dup', $metadata: {} }));
    expect(await store.add(report)).toBe(true);
    expect(await store.add(report)).toBe(false);
    expect(ddb.commandCalls(PutCommand)[0]!.args[0].input.ConditionExpression).toBe(
      'attribute_not_exists(ratingId)',
    );
  });
});

describe('SnsReportNotifier', () => {
  it('emails what’s needed to moderate, with an ASCII subject', async () => {
    sns.on(PublishCommand).resolves({});
    await new SnsReportNotifier('arn:topic', new SNSClient({})).notify({
      chain: 'sweetfin-poke',
      chainName: 'Sweetfin Poké',
      rating: {
        chain: 'sweetfin-poke',
        userId: 'author-sub',
        displayName: 'Spammer',
        forks: 1.25,
        review: 'Buy pills',
        createdAt: 'x',
        updatedAt: 'x',
      },
      reason: 'spam',
      reportCount: 3,
      hidden: true,
    });
    const input = sns.commandCalls(PublishCommand)[0]!.args[0].input;
    expect(input.Subject).toBe('Review reported: Sweetfin Pok');
    expect(input.Message).toContain('Reason: Spam or advertising');
    expect(input.Message).toContain('Reports so far: 3 (the review text is now hidden)');
    expect(input.Message).toContain('"Spammer", 1 fork, 1 tine');
    expect(input.Message).toContain('userId: author-sub');
  });
});
