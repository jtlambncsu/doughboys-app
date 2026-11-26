import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

const repoPath = (relative: string) => fileURLToPath(new URL(`../../${relative}`, import.meta.url));

export interface ApiStackProps extends StackProps {
  /** Browser origins allowed to call the API. Omit to allow any. */
  allowedOrigins?: string[];
}

/**
 * A public, read-only API over episode data: DynamoDB + a Lambda running the Express app,
 * behind an API Gateway HTTP API, plus a weekly job that refreshes the data from the wiki.
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

    const shared: Partial<NodejsFunctionProps> = {
      projectRoot: repoPath(''),
      depsLockFilePath: repoPath('package-lock.json'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      environment: { EPISODES_TABLE: table.tableName, NODE_OPTIONS: '--enable-source-maps' },
      bundling: { minify: true, sourceMap: true, externalModules: [] },
    };

    const apiFn = new NodejsFunction(this, 'ApiFunction', {
      ...shared,
      entry: repoPath('apps/api/src/lambda.ts'),
      timeout: Duration.seconds(10),
      environment: {
        ...shared.environment,
        ...(props.allowedOrigins?.length && { ALLOWED_ORIGINS: props.allowedOrigins.join(',') }),
      },
      logGroup: new LogGroup(this, 'ApiLogs', {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    table.grantReadData(apiFn); // the API only reads

    // Reads ~1,100 pages from the wiki in batches of 50; takes about half a minute.
    const importFn = new NodejsFunction(this, 'ImportFunction', {
      ...shared,
      entry: repoPath('apps/api/src/importLambda.ts'),
      timeout: Duration.minutes(5),
      logGroup: new LogGroup(this, 'ImportLogs', {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    table.grantWriteData(importFn);

    // New episodes come out on Thursdays and fans update the wiki over the following days.
    new Rule(this, 'WeeklyImport', {
      description: 'Refresh episode data from the Doughboys Wikia',
      schedule: Schedule.cron({ weekDay: 'SUN', hour: '15', minute: '17' }),
      targets: [new LambdaFunction(importFn)],
    });

    const api = new HttpApi(this, 'HttpApi', {
      defaultIntegration: new HttpLambdaIntegration('ApiIntegration', apiFn),
      corsPreflight: {
        allowOrigins: props.allowedOrigins?.length ? props.allowedOrigins : ['*'],
        // Every method the web app calls. A method missing here makes the browser block
        // the request, even though the API itself supports it.
        allowMethods: [CorsHttpMethod.GET],
        maxAge: Duration.days(1),
      },
      createDefaultStage: false,
    });

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
