# 0013. Guardrails against bots and surprise bills, and a stats dashboard

- **Status:** Accepted
- **Date:** 2026-11-27

## Context

With public sign-up (ADR 0009), the owner wanted to see how many accounts exist, and to be
sure the app can't run up a large bill, fill with bot accounts or hide problems. Risks:
Cognito bills per monthly active user beyond its free tier, so a bot sign-up flood costs
money; and nobody would notice errors or spending until the bill came.

## Decision

- **A daily sign-up cap** (default 50, the `MAX_SIGNUPS_PER_DAY` GitHub variable). A
  Cognito pre sign-up trigger counts self sign-ups per UTC day in DynamoDB with an atomic
  conditional update, and refuses the rest with "sign-ups are paused for today". Accounts an
  admin creates aren't capped. 50 matches Cognito's default email sender (about 50
  emails a day); beyond that, new accounts couldn't get verification codes anyway.
- **A CloudWatch dashboard** (`DoughboysApi-Fans`): totals of accounts, fans with display
  names and ratings (published hourly by a small Lambda as custom metrics), sign-ups and
  sign-ins per day, refused sign-ups, API traffic and errors, function errors.
- **Email alerts** to the `ALERT_EMAIL` GitHub variable (kept out of the code) through SNS:
  more than 30 sign-ups in an hour, the cap refusing anyone, and more than 10 API server
  errors in 5 minutes.
- **An AWS Budget** for the account (`MONTHLY_BUDGET_USD`, default $10): emails at 50% of
  actual spend and when the month's forecast passes the budget.
- Existing guards stay: API throttling (10 requests/s), auth on every write, one rating per
  fan per chain, log retention of a month.

## Alternatives considered

- **AWS WAF on the user pool** (rate limits per IP, bot control). Stronger against bots, but
  about $6+/month before any traffic; worth adding if the cap is hit by bots.
- **Cognito Plus threat protection.** Adaptive auth and compromised-credential checks, but
  charged per active user.
- **CAPTCHA on sign-up.** Managed login doesn't offer one; it would need a custom sign-up page.
- **A disposable-email blocklist** in the trigger. Considered, but the maintained packages
  weren't reviewed in time; email verification plus the cap covers most of it.
- **An admin page in the app** for stats. More code and another authorization surface; the
  AWS console already shows this securely.

## Consequences

- About $1.30/month: three custom metrics ($0.90) and three alarms ($0.30). Dashboards and
  budgets are within free allowances.
- On a viral day, real fans are turned away after the cap; raise `MAX_SIGNUPS_PER_DAY` (and
  set up Amazon SES for email) if that happens.

## Explaining it in an interview

"Public sign-up means bots, and Cognito charges per active user, so I put a circuit breaker in
front: a pre sign-up trigger with an atomic daily counter in DynamoDB. Then visibility and
alerts: a CloudWatch dashboard, alarms on sign-up spikes and errors, and an AWS Budget, so I
hear about problems by email, not on the bill."
