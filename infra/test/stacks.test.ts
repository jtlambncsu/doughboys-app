import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import { GithubDeployStack } from '../lib/github-deploy-stack.js';

describe('ApiStack', () => {
  const template = Template.fromStack(
    new ApiStack(new App(), 'Test', { allowedOrigins: ['https://forks.example'] }),
  );

  it('keys episodes by slug and keeps the table if the stack is deleted', () => {
    template.hasResource('AWS::DynamoDB::GlobalTable', {
      Properties: Match.objectLike({ KeySchema: [{ AttributeName: 'slug', KeyType: 'HASH' }] }),
      DeletionPolicy: 'Retain',
    });
  });

  it('keeps classified chains in their own table', () => {
    template.hasResource('AWS::DynamoDB::GlobalTable', {
      Properties: Match.objectLike({ KeySchema: [{ AttributeName: 'name', KeyType: 'HASH' }] }),
      DeletionPolicy: 'Retain',
    });
  });

  it('gives only the import job the Anthropic key', () => {
    const importPolicies = JSON.stringify(
      template.findResources('AWS::IAM::Policy', {
        Properties: { Roles: [{ Ref: Match.stringLikeRegexp('ImportFunction') }] },
      }),
    );
    const apiPolicies = JSON.stringify(
      template.findResources('AWS::IAM::Policy', {
        Properties: { Roles: [{ Ref: Match.stringLikeRegexp('ApiFunction') }] },
      }),
    );
    expect(importPolicies).toContain('ssm:GetParameter');
    expect(apiPolicies).not.toContain('ssm:');
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          ANTHROPIC_KEY_PARAMETER: '/doughboys-app/anthropic-api-key',
        }),
      },
    });
  });

  it('allows the web app’s methods and headers in CORS', () => {
    // Keep in sync with apps/web/src/api/client.ts.
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({
        AllowMethods: ['GET', 'PUT', 'DELETE'],
        AllowHeaders: ['authorization', 'content-type'],
        AllowOrigins: ['https://forks.example'],
      }),
    });
  });

  it('requires a Cognito token on every route that reads or changes a fan’s data', () => {
    for (const routeKey of [
      'GET /api/me',
      'PUT /api/me',
      'DELETE /api/me',
      'GET /api/me/ratings',
      'PUT /api/chains/{slug}/rating',
      'DELETE /api/chains/{slug}/rating',
    ]) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: routeKey,
        AuthorizationType: 'JWT',
      });
    }
    // Browsing stays public.
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: '$default',
      AuthorizationType: 'NONE',
    });
  });

  it('lets fans sign up, but only after verifying their email', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
      AutoVerifiedAttributes: ['email'],
      UsernameAttributes: ['email'],
      Policies: Match.objectLike({
        PasswordPolicy: Match.objectLike({ MinimumLength: 12 }),
        SignInPolicy: { AllowedFirstAuthFactors: ['PASSWORD', 'WEB_AUTHN'] },
      }),
      DeletionProtection: 'ACTIVE',
    });
  });

  it('uses the code flow with PKCE and only redirects to known web URLs', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['code'],
      GenerateSecret: false,
      PreventUserExistenceErrors: 'ENABLED',
      CallbackURLs: ['https://forks.example', 'http://localhost:5173'],
    });
  });

  it('keeps fans’ ratings and profiles, with point-in-time recovery', () => {
    template.hasResource('AWS::DynamoDB::GlobalTable', {
      Properties: Match.objectLike({
        KeySchema: [
          { AttributeName: 'chain', KeyType: 'HASH' },
          { AttributeName: 'userId', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [Match.objectLike({ IndexName: 'byUser' })],
        Replicas: [
          Match.objectLike({
            PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
          }),
        ],
      }),
      DeletionPolicy: 'Retain',
    });
  });

  it('lets the API delete Cognito users, and nothing else in Cognito', () => {
    const apiPolicies = JSON.stringify(
      template.findResources('AWS::IAM::Policy', {
        Properties: { Roles: [{ Ref: Match.stringLikeRegexp('ApiFunction') }] },
      }),
    );
    expect(apiPolicies).toContain('cognito-idp:AdminDeleteUser');
    expect(apiPolicies.match(/cognito-idp:/g)).toHaveLength(1);
  });

  it('throttles the API to cap costs', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 },
    });
  });

  it('refreshes from the feed and the wiki daily', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'cron(17 15 * * ? *)',
    });
  });

  it('lets the import job read, write and delete episodes', () => {
    // It scans to find stale feed-only episodes; a write-only grant failed in production.
    const actions = JSON.stringify(
      template.findResources('AWS::IAM::Policy', {
        Properties: { Roles: [{ Ref: Match.stringLikeRegexp('ImportFunction') }] },
      }),
    );
    for (const action of ['dynamodb:Scan', 'dynamodb:BatchWriteItem', 'dynamodb:DeleteItem']) {
      expect(actions).toContain(action);
    }
  });

  it('gives the API read-only access to episodes and chains', () => {
    const policies = template.findResources('AWS::IAM::Policy', {
      Properties: { Roles: [{ Ref: Match.stringLikeRegexp('ApiFunction') }] },
    });
    type Statement = { Action: string | string[]; Resource: unknown };
    const statements = Object.values(policies).flatMap(
      (p) =>
        (p as { Properties: { PolicyDocument: { Statement: Statement[] } } }).Properties
          .PolicyDocument.Statement,
    );
    const on = (table: string) =>
      statements
        .filter((s) => JSON.stringify(s.Resource).includes(table))
        .flatMap((s) => [s.Action].flat());
    for (const table of ['Episodes', 'Chains']) {
      expect(on(table)).toContain('dynamodb:GetItem');
      expect(on(table)).not.toContain('dynamodb:PutItem');
      expect(on(table)).not.toContain('dynamodb:DeleteItem');
    }
  });
});

describe('guardrails (ADR 0013)', () => {
  const build = (props: Partial<ConstructorParameters<typeof ApiStack>[2]> = {}) =>
    Template.fromStack(
      new ApiStack(new App(), 'Test', { allowedOrigins: ['https://forks.example'], ...props }),
    );
  const withAlerts = build({ alertEmail: 'owner@example.com', maxSignupsPerDay: 50 });
  const withoutAlerts = build();

  it('caps sign-ups per day with a pre sign-up trigger', () => {
    withAlerts.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: { PreSignUp: Match.anyValue() },
    });
    withAlerts.hasResourceProperties('AWS::Lambda::Function', {
      Environment: { Variables: Match.objectLike({ MAX_SIGNUPS_PER_DAY: '50' }) },
    });
    withAlerts.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      KeySchema: [{ AttributeName: 'day', KeyType: 'HASH' }],
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
    });
  });

  it('publishes stats hourly, only into its own metric namespace', () => {
    withAlerts.hasResourceProperties('AWS::Events::Rule', { ScheduleExpression: 'rate(1 hour)' });
    withAlerts.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'cloudwatch:PutMetricData',
            Condition: { StringEquals: { 'cloudwatch:namespace': 'DoughboysApp' } },
          }),
        ]),
      },
    });
    withAlerts.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
  });

  it('emails alerts for sign-up spikes, the cap, API errors and spending', () => {
    withAlerts.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'owner@example.com',
    });
    withAlerts.resourceCountIs('AWS::CloudWatch::Alarm', 3);
    withAlerts.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({ BudgetLimit: { Amount: 10, Unit: 'USD' }, TimeUnit: 'MONTHLY' }),
    });
  });

  it('creates no alerts without an email (and still caps sign-ups)', () => {
    withoutAlerts.resourceCountIs('AWS::SNS::Topic', 0);
    withoutAlerts.resourceCountIs('AWS::CloudWatch::Alarm', 0);
    withoutAlerts.resourceCountIs('AWS::Budgets::Budget', 0);
    withoutAlerts.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: { PreSignUp: Match.anyValue() },
    });
  });
});

describe('GithubDeployStack', () => {
  it('only trusts main of this repo', () => {
    const template = Template.fromStack(
      new GithubDeployStack(new App(), 'Deploy', {
        githubRepo: 'jtlambncsu/doughboys-app',
        githubIds: { owner: 1, repo: 2 },
      }),
    );
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: [
          Match.objectLike({
            Condition: {
              StringEquals: Match.objectLike({
                'token.actions.githubusercontent.com:sub': [
                  'repo:jtlambncsu@1/doughboys-app@2:ref:refs/heads/main',
                  'repo:jtlambncsu/doughboys-app:ref:refs/heads/main',
                ],
              }),
            },
          }),
        ],
      }),
    });
  });
});
