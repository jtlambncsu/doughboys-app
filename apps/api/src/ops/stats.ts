import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

export const METRICS_NAMESPACE = 'DoughboysApp';

export interface StatsDeps {
  userPoolId: string;
  ratingsTable: string;
  profilesTable: string;
  cognito?: CognitoIdentityProviderClient;
  dynamo?: DynamoDBClient;
  cloudwatch?: CloudWatchClient;
}

/** Counts items without reading them (Select COUNT), across pages. Small tables. */
async function countItems(dynamo: DynamoDBClient, table: string) {
  let count = 0;
  let start: Record<string, unknown> | undefined;
  do {
    const page = await dynamo.send(
      new ScanCommand({ TableName: table, Select: 'COUNT', ExclusiveStartKey: start as never }),
    );
    count += page.Count ?? 0;
    start = page.LastEvaluatedKey;
  } while (start);
  return count;
}

/**
 * Hourly: publishes totals to CloudWatch for the dashboard. Accounts is Cognito's own
 * (approximate) count; "fans" are accounts that picked a display name.
 */
export async function publishStats({
  userPoolId,
  ratingsTable,
  profilesTable,
  cognito = new CognitoIdentityProviderClient({}),
  dynamo = new DynamoDBClient({}),
  cloudwatch = new CloudWatchClient({}),
}: StatsDeps) {
  const [pool, ratings, fans] = await Promise.all([
    cognito.send(new DescribeUserPoolCommand({ UserPoolId: userPoolId })),
    countItems(dynamo, ratingsTable),
    countItems(dynamo, profilesTable),
  ]);
  const stats = {
    Accounts: pool.UserPool?.EstimatedNumberOfUsers ?? 0,
    FansWithNames: fans,
    Ratings: ratings,
  };
  await cloudwatch.send(
    new PutMetricDataCommand({
      Namespace: METRICS_NAMESPACE,
      MetricData: Object.entries(stats).map(([MetricName, Value]) => ({
        MetricName,
        Value,
        Unit: 'Count',
      })),
    }),
  );
  console.log(JSON.stringify(stats));
  return stats;
}
