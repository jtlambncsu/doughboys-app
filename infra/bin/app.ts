import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack.js';
import { assertOrigins, listSetting, optionalEmail, positiveInt } from '../lib/config.js';
import { GithubDeployStack } from '../lib/github-deploy-stack.js';

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

/**
 * Comma-separated origins allowed to call the API from a browser: the web app's URL once
 * it's hosted. Set the `allowedOrigins` context value or the ALLOWED_ORIGINS GitHub variable.
 * Until then any origin may call it (it's public, read-only data).
 */
const allowedOrigins = assertOrigins(
  listSetting(app.node.tryGetContext('allowedOrigins'), process.env.ALLOWED_ORIGINS),
  'ALLOWED_ORIGINS',
);

/**
 * Guardrails (ADR 0013), from GitHub variables in CI: where alerts go (ALERT_EMAIL; kept out
 * of the code), the daily sign-up cap and the monthly budget.
 */
new ApiStack(app, 'DoughboysApi', {
  env,
  allowedOrigins,
  webUrls: allowedOrigins,
  alertEmail: optionalEmail(process.env.ALERT_EMAIL, 'ALERT_EMAIL'),
  maxSignupsPerDay: positiveInt(process.env.MAX_SIGNUPS_PER_DAY, 'MAX_SIGNUPS_PER_DAY'),
  monthlyBudgetUsd: positiveInt(process.env.MONTHLY_BUDGET_USD, 'MONTHLY_BUDGET_USD'),
});

/**
 * One-time setup, deployed from your machine: lets GitHub Actions deploy DoughboysApi.
 * See docs/DEPLOYMENT.md for the exact command, including the repo's numeric ID and the
 * ARN of the GitHub OIDC provider (Puzzle Log already created one in this account).
 */
const repoId = app.node.tryGetContext('githubRepoId');
new GithubDeployStack(app, 'DoughboysGithubDeploy', {
  env,
  githubRepo: 'jtlambncsu/doughboys-app',
  githubIds: repoId ? { owner: 32425340, repo: Number(repoId) } : undefined,
  existingOidcProviderArn: app.node.tryGetContext('existingOidcProviderArn'),
});
