import { CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import {
  Alarm,
  ComparisonOperator,
  Dashboard,
  GraphWidget,
  MathExpression,
  Metric,
  SingleValueWidget,
  TextWidget,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { type UserPool, type UserPoolClient, UserPoolOperation } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, Billing, type TableV2, TableV2 as Table } from 'aws-cdk-lib/aws-dynamodb';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import type { Function as LambdaFunctionResource, IFunction } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FilterPattern, LogGroup, MetricFilter, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface OpsProps {
  userPool: UserPool;
  client: UserPoolClient;
  ratings: TableV2;
  profiles: TableV2;
  api: HttpApi;
  /** The API function: it also emails report notifications through the alerts topic. */
  apiFn: LambdaFunctionResource;
  importFn: IFunction;
  /** Shared Lambda settings (runtime, bundling) from the stack. */
  functionDefaults: Partial<NodejsFunctionProps>;
  entry: (file: string) => string;
  /** Most self sign-ups allowed per UTC day. */
  maxSignupsPerDay: number;
  /** Where alarms and budget alerts go. Without it, no alerts are created. */
  alertEmail?: string;
  /** Monthly AWS budget for this account, in USD. */
  monthlyBudgetUsd: number;
}

/**
 * Guardrails and visibility for the owner (ADR 0013): a daily sign-up cap, an hourly stats
 * job, a CloudWatch dashboard, and email alerts for sign-up spikes, errors and spending.
 */
export class Ops extends Construct {
  constructor(scope: Construct, id: string, props: OpsProps) {
    super(scope, id);
    const stack = Stack.of(this);

    // --- Sign-up cap: Cognito asks this function before creating each account. ---
    const signupCounts = new Table(this, 'SignupCounts', {
      partitionKey: { name: 'day', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY, // a few days of counters, nothing to keep
    });
    const guardLogs = new LogGroup(this, 'SignupGuardLogs', {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const guard = new NodejsFunction(this, 'SignupGuard', {
      ...props.functionDefaults,
      entry: props.entry('apps/api/src/ops/signupGuardLambda.ts'),
      timeout: Duration.seconds(5),
      environment: {
        SIGNUP_COUNTS_TABLE: signupCounts.tableName,
        MAX_SIGNUPS_PER_DAY: String(props.maxSignupsPerDay),
      },
      logGroup: guardLogs,
    });
    signupCounts.grantReadWriteData(guard);
    props.userPool.addTrigger(UserPoolOperation.PRE_SIGN_UP, guard);

    // --- Hourly stats for the dashboard: accounts, fans with names, ratings. ---
    const stats = new NodejsFunction(this, 'Stats', {
      ...props.functionDefaults,
      entry: props.entry('apps/api/src/ops/statsLambda.ts'),
      timeout: Duration.seconds(30),
      environment: {
        USER_POOL_ID: props.userPool.userPoolId,
        RATINGS_TABLE: props.ratings.tableName,
        PROFILES_TABLE: props.profiles.tableName,
      },
      logGroup: new LogGroup(this, 'StatsLogs', {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    props.ratings.grantReadData(stats);
    props.profiles.grantReadData(stats);
    stats.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:DescribeUserPool'],
        resources: [props.userPool.userPoolArn],
      }),
    );
    stats.addToRolePolicy(
      new PolicyStatement({
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'], // PutMetricData has no resource ARNs; limited by namespace instead
        conditions: { StringEquals: { 'cloudwatch:namespace': 'DoughboysApp' } },
      }),
    );
    new Rule(this, 'HourlyStats', {
      schedule: Schedule.rate(Duration.hours(1)),
      targets: [new LambdaFunction(stats)],
    });

    // --- Metrics ---
    const total = (name: string, label: string) =>
      new Metric({
        namespace: 'DoughboysApp',
        metricName: name,
        statistic: 'Maximum',
        period: Duration.hours(1),
        label,
      });
    const cognito = (name: string, label: string, period = Duration.days(1)) =>
      new Metric({
        namespace: 'AWS/Cognito',
        metricName: name,
        dimensionsMap: {
          UserPool: props.userPool.userPoolId,
          UserPoolClient: props.client.userPoolClientId,
        },
        statistic: 'Sum',
        period,
        label,
      });
    const refusedSignups = new MetricFilter(this, 'RefusedSignups', {
      logGroup: guardLogs,
      metricNamespace: 'DoughboysApp',
      metricName: 'RefusedSignups',
      filterPattern: FilterPattern.stringValue(
        '$.message',
        '=',
        'Sign-up refused: daily limit reached',
      ),
      metricValue: '1',
    }).metric({ statistic: 'Sum', period: Duration.hours(1), label: 'Sign-ups refused (cap)' });

    new Dashboard(this, 'Dashboard', {
      dashboardName: `${stack.stackName}-Fans`,
      widgets: [
        [
          new TextWidget({
            width: 24,
            height: 2,
            markdown: `## Doughboys App: fans\nTotals update hourly. Sign-ups are capped at **${props.maxSignupsPerDay} a day**; refused sign-ups appear below.`,
          }),
        ],
        [
          new SingleValueWidget({
            title: 'Totals',
            width: 24,
            height: 4,
            metrics: [
              total('Accounts', 'Accounts'),
              total('FansWithNames', 'Fans with a display name'),
              total('Ratings', 'Ratings'),
            ],
          }),
        ],
        [
          new GraphWidget({
            title: 'Sign-ups and sign-ins per day',
            width: 12,
            left: [cognito('SignUpSuccesses', 'Sign-ups'), cognito('SignInSuccesses', 'Sign-ins')],
          }),
          new GraphWidget({
            title: 'Refused sign-ups (daily cap)',
            width: 12,
            left: [refusedSignups],
          }),
        ],
        [
          new GraphWidget({
            title: 'API requests and errors',
            width: 12,
            left: [
              props.api.metricCount({ period: Duration.hours(1), label: 'Requests' }),
              props.api.metricClientError({ period: Duration.hours(1), label: '4xx' }),
              props.api.metricServerError({ period: Duration.hours(1), label: '5xx' }),
            ],
          }),
          new GraphWidget({
            title: 'Function errors',
            width: 12,
            left: [
              props.apiFn.metricErrors({ period: Duration.hours(1), label: 'API' }),
              props.importFn.metricErrors({ period: Duration.hours(1), label: 'Daily import' }),
              guard.metricErrors({ period: Duration.hours(1), label: 'Sign-up guard' }),
            ],
          }),
        ],
      ],
    });

    new CfnOutput(stack, 'DashboardUrl', {
      value: `https://${stack.region}.console.aws.amazon.com/cloudwatch/home?region=${stack.region}#dashboards/dashboard/${stack.stackName}-Fans`,
      description: 'Fans, sign-ups and errors',
    });

    if (!props.alertEmail) return;

    // --- Email alerts (only when an alert email is configured) ---
    const topic = new Topic(this, 'Alerts', { displayName: 'Doughboys App alerts' });
    // A fixed construct ID: `topic.addSubscription(new EmailSubscription(email))` names the
    // resource after the address, which then shows in the (public) deploy logs.
    new Subscription(this, 'AlertEmail', {
      topic,
      protocol: SubscriptionProtocol.EMAIL,
      endpoint: props.alertEmail,
    });
    // Review reports are emailed through the same topic (ADR 0014).
    props.apiFn.addEnvironment('ALERTS_TOPIC_ARN', topic.topicArn);
    topic.grantPublish(props.apiFn);

    const alarm = (
      id: string,
      description: string,
      metric: Metric | MathExpression,
      threshold: number,
    ) =>
      new Alarm(this, id, {
        alarmDescription: description,
        metric,
        threshold,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(new SnsAction(topic));

    alarm(
      'SignupSpike',
      'More than 30 sign-ups in an hour: possibly bots. Check the dashboard.',
      cognito('SignUpSuccesses', 'Sign-ups', Duration.hours(1)),
      30,
    );
    alarm(
      'SignupCapHit',
      'The daily sign-up cap refused someone. Real growth, or bots: check the dashboard.',
      refusedSignups,
      0,
    );
    alarm(
      'ApiErrors',
      'The API returned more than 10 server errors in 5 minutes.',
      props.api.metricServerError({ period: Duration.minutes(5), statistic: 'Sum' }),
      10,
    );

    // A monthly budget for the whole AWS account: email at $X actual spend, and when the
    // forecast passes the budget. Budgets are free for the first two per account.
    new CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `${stack.stackName}-monthly`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 50,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: props.alertEmail }],
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: props.alertEmail }],
        },
      ],
    });
  }
}
