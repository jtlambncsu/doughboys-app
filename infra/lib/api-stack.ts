import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod, HttpStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { Auth } from './auth.js';

/** Where the Anthropic API key lives in SSM Parameter Store (a SecureString, made by hand). */
export const ANTHROPIC_KEY_PARAMETER = '/doughboys-app/anthropic-api-key';

const repoPath = (relative: string) => fileURLToPath(new URL(`../../${relative}`, import.meta.url));

export interface ApiStackProps extends StackProps {
  /** Browser origins allowed to call the API. Omit to allow any. */
  allowedOrigins?: string[];
  /** Web app URLs that sign-in may redirect back to. Defaults to the allowed origins. */
  webUrls?: string[];
}

/**
 * A public, read-only API over episode data: DynamoDB + a Lambda running the Express app,
 * behind an API Gateway HTTP API, plus a daily job that refreshes the data from the wiki and
 * the podcast feed.
 */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps = {}) {
    super(scope, id, props);

    // Everything here can be re-imported from the wiki, but RETAIN anyway: it's the house
    // rule for stateful resources, and user data (your own ratings) will join it later.
    const table = new TableV2(this, 'Episodes', {
      partitionKey: { name: 'slug', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Each chain's category and website, from Claude. Re-creatable, but it costs API calls,
    // so it's kept like the episodes table.
    const chains = new TableV2(this, 'Chains', {
      partitionKey: { name: 'name', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Created once by hand (docs/DEPLOYMENT.md), so the secret never passes through code,
    // CI or CloudFormation. Until it exists, imports still work; chains stay unclassified.
    const anthropicKey = StringParameter.fromSecureStringParameterAttributes(this, 'AnthropicKey', {
      parameterName: ANTHROPIC_KEY_PARAMETER,
    });

    // Fans' accounts (ADR 0009).
    const auth = new Auth(this, 'Auth', { webUrls: props.webUrls ?? props.allowedOrigins ?? [] });

    // Fans' ratings: one per person per chain, so the key is (chain, user) and the database
    // itself enforces "one each". The byUser index lists a person's ratings ("My ratings")
    // and finds them all when they delete their account. User data: kept if the stack is
    // deleted, and recoverable to any second of the last 35 days.
    const ratings = new TableV2(this, 'Ratings', {
      partitionKey: { name: 'chain', type: AttributeType.STRING },
      sortKey: { name: 'userId', type: AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: 'byUser',
          partitionKey: { name: 'userId', type: AttributeType.STRING },
          sortKey: { name: 'chain', type: AttributeType.STRING },
        },
      ],
      billing: Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Public display names, chosen by each fan.
    const profiles = new TableV2(this, 'Profiles', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const shared: Partial<NodejsFunctionProps> = {
      projectRoot: repoPath(''),
      depsLockFilePath: repoPath('package-lock.json'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      environment: {
        EPISODES_TABLE: table.tableName,
        CHAINS_TABLE: chains.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: { minify: true, sourceMap: true, externalModules: [] },
    };

    const apiFn = new NodejsFunction(this, 'ApiFunction', {
      ...shared,
      entry: repoPath('apps/api/src/lambda.ts'),
      timeout: Duration.seconds(10),
      environment: {
        ...shared.environment,
        RATINGS_TABLE: ratings.tableName,
        PROFILES_TABLE: profiles.tableName,
        USER_POOL_ID: auth.userPool.userPoolId,
        ...(props.allowedOrigins?.length && { ALLOWED_ORIGINS: props.allowedOrigins.join(',') }),
      },
      logGroup: new LogGroup(this, 'ApiLogs', {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    table.grantReadData(apiFn); // the API only reads
    chains.grantReadData(apiFn);
    ratings.grantReadWriteData(apiFn);
    profiles.grantReadWriteData(apiFn);
    // "Delete my account" removes the Cognito user too. Only that action, only this pool.
    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminDeleteUser'],
        resources: [auth.userPool.userPoolArn],
      }),
    );

    // Reads ~1,100 pages from the wiki in batches of 50 (about half a minute) and the podcast
    // feed, then asks
    // Claude to classify chains it hasn't seen (minutes the first time, seconds after).
    const importFn = new NodejsFunction(this, 'ImportFunction', {
      ...shared,
      entry: repoPath('apps/api/src/importLambda.ts'),
      timeout: Duration.minutes(10),
      environment: { ...shared.environment, ANTHROPIC_KEY_PARAMETER },
      logGroup: new LogGroup(this, 'ImportLogs', {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    // Reads too: it lists episodes to remove feed-only ones the wiki now covers.
    table.grantReadWriteData(importFn);
    chains.grantReadWriteData(importFn);
    anthropicKey.grantRead(importFn);

    // Daily: new episodes appear in the podcast feed on release day, and fans fill in the
    // wiki over the following days. About 25 gentle wiki requests and one feed request.
    new Rule(this, 'DailyImport', {
      description: 'Refresh episodes from the podcast feed and the Doughboys Wikia',
      schedule: Schedule.cron({ hour: '15', minute: '17' }),
      targets: [new LambdaFunction(importFn)],
    });

    const integration = new HttpLambdaIntegration('ApiIntegration', apiFn);
    const api = new HttpApi(this, 'HttpApi', {
      // Everything is public by default (browsing); the routes below need a signed-in fan.
      defaultIntegration: integration,
      corsPreflight: {
        allowOrigins: props.allowedOrigins?.length ? props.allowedOrigins : ['*'],
        // Every method and header the web app sends. One missing here makes the browser
        // block the request, even though the API itself supports it.
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.PUT, CorsHttpMethod.DELETE],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.days(1),
      },
      createDefaultStage: false,
    });

    // API Gateway checks the Cognito access token on these routes before Lambda runs; the
    // Express app checks again (defense in depth). A request without a valid token gets 401.
    const authorizer = new HttpUserPoolAuthorizer('CognitoAuthorizer', auth.userPool, {
      userPoolClients: [auth.client],
    });
    const signedIn: [string, HttpMethod[]][] = [
      ['/api/me', [HttpMethod.GET, HttpMethod.PUT, HttpMethod.DELETE]],
      ['/api/me/ratings', [HttpMethod.GET]],
      ['/api/chains/{slug}/rating', [HttpMethod.PUT, HttpMethod.DELETE]],
    ];
    for (const [path, methods] of signedIn) {
      api.addRoutes({ path, methods, integration, authorizer });
    }

    // A cost ceiling: the API handles at most 10 requests a second, whoever sends them.
    new HttpStage(this, 'DefaultStage', {
      httpApi: api,
      autoDeploy: true,
      throttle: { rateLimit: 10, burstLimit: 20 },
    });

    new CfnOutput(this, 'ApiUrl', {
      value: api.apiEndpoint,
      description: 'Set this as VITE_API_URL for the web app',
    });
    new CfnOutput(this, 'EpisodesTableName', { value: table.tableName });
    new CfnOutput(this, 'ImportFunctionName', {
      value: importFn.functionName,
      description: 'Run once after the first deploy to load the data',
    });
  }
}
