import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { PreSignUpTriggerEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSignupGuard,
  DynamoSignupCounter,
  SignupsPausedError,
  type SignupCounter,
} from './signupGuard.js';
import { publishStats } from './stats.js';

const event = (triggerSource: string) => ({ triggerSource }) as PreSignUpTriggerEvent;

/** An in-memory counter with the same rule as DynamoDB's conditional update. */
class FakeCounter implements SignupCounter {
  readonly days = new Map<string, number>();
  async tryCount(day: string, limit: number) {
    const n = this.days.get(day) ?? 0;
    if (n >= limit) return false;
    this.days.set(day, n + 1);
    return true;
  }
}

describe('sign-up guard', () => {
  it('allows sign-ups up to the daily limit, then refuses them', async () => {
    const counter = new FakeCounter();
    const guard = createSignupGuard(counter, 2, () => new Date('2026-12-01T10:00:00Z'));
    await expect(guard(event('PreSignUp_SignUp'))).resolves.toBeDefined();
    await expect(guard(event('PreSignUp_SignUp'))).resolves.toBeDefined();
    await expect(guard(event('PreSignUp_SignUp'))).rejects.toThrow(SignupsPausedError);
  });

  it('starts a fresh count each UTC day', async () => {
    const counter = new FakeCounter();
    let now = new Date('2026-12-01T23:59:00Z');
    const guard = createSignupGuard(counter, 1, () => now);
    await guard(event('PreSignUp_SignUp'));
    now = new Date('2026-12-02T00:01:00Z');
    await expect(guard(event('PreSignUp_SignUp'))).resolves.toBeDefined();
  });

  it('doesn’t count accounts an admin creates', async () => {
    const counter = new FakeCounter();
    const guard = createSignupGuard(counter, 0);
    await expect(guard(event('PreSignUp_AdminCreateUser'))).resolves.toBeDefined();
  });
});

describe('DynamoSignupCounter', () => {
  const ddb = mockClient(DynamoDBDocumentClient);
  beforeEach(() => ddb.reset());
  const counter = new DynamoSignupCounter(
    'SignupCounts',
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
    () => 0,
  );

  it('counts atomically with a condition on the limit, and expires the day', async () => {
    ddb.on(UpdateCommand).resolves({});
    expect(await counter.tryCount('2026-12-01', 100)).toBe(true);
    const input = ddb.commandCalls(UpdateCommand)[0]!.args[0].input;
    expect(input).toMatchObject({
      Key: { day: '2026-12-01' },
      ConditionExpression: 'attribute_not_exists(signups) OR signups < :limit',
      ExpressionAttributeValues: { ':one': 1, ':limit': 100, ':expires': 7 * 24 * 60 * 60 },
    });
  });

  it('reports a full day as false', async () => {
    ddb
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'full', $metadata: {} }));
    expect(await counter.tryCount('2026-12-01', 100)).toBe(false);
  });
});

describe('publishStats', () => {
  it('publishes accounts, fans and ratings to CloudWatch', async () => {
    const cognito = mockClient(CognitoIdentityProviderClient);
    const dynamo = mockClient(DynamoDBClient);
    const cloudwatch = mockClient(CloudWatchClient);
    cognito.on(DescribeUserPoolCommand).resolves({ UserPool: { EstimatedNumberOfUsers: 12 } });
    dynamo
      .on(ScanCommand, { TableName: 'Ratings' })
      .resolvesOnce({ Count: 5, LastEvaluatedKey: { chain: { S: 'x' } } })
      .resolves({ Count: 2 });
    dynamo.on(ScanCommand, { TableName: 'Profiles' }).resolves({ Count: 9 });
    cloudwatch.on(PutMetricDataCommand).resolves({});

    const stats = await publishStats({
      userPoolId: 'pool',
      ratingsTable: 'Ratings',
      profilesTable: 'Profiles',
      cognito: new CognitoIdentityProviderClient({}),
      dynamo: new DynamoDBClient({}),
      cloudwatch: new CloudWatchClient({}),
    });

    expect(stats).toEqual({ Accounts: 12, FansWithNames: 9, Ratings: 7 });
    expect(cloudwatch.commandCalls(PutMetricDataCommand)[0]!.args[0].input).toMatchObject({
      Namespace: 'DoughboysApp',
      MetricData: [
        { MetricName: 'Accounts', Value: 12 },
        { MetricName: 'FansWithNames', Value: 9 },
        { MetricName: 'Ratings', Value: 7 },
      ],
    });
  });
});
