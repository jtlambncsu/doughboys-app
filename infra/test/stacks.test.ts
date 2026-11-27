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

  it('allows GET from the web app in CORS', () => {
    // Keep in sync with apps/web/src/api/client.ts.
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({
        AllowMethods: ['GET'],
        AllowOrigins: ['https://forks.example'],
      }),
    });
  });

  it('throttles the API to cap costs', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 },
    });
  });

  it('refreshes from the wiki weekly', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'cron(17 15 ? * SUN *)',
    });
  });

  it('gives the API read-only access to the table', () => {
    const policies = template.findResources('AWS::IAM::Policy', {
      Properties: { Roles: [{ Ref: Match.stringLikeRegexp('ApiFunction') }] },
    });
    const actions = JSON.stringify(policies);
    expect(actions).toContain('dynamodb:GetItem');
    expect(actions).not.toContain('dynamodb:PutItem');
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
