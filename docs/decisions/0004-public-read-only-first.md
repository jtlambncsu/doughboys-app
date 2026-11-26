# 0004. Public, read-only first; sign-in later

- **Status:** Accepted
- **Date:** 2026-11-26

## Context

The planned features split in two: browsing the show's ratings (public data) and logging
your own visits and ratings (per-user data).

## Decision

Ship browsing first, with no sign-in: no Cognito, no authorizer, GET only. API Gateway
throttling caps cost. Add sign-in (reusing Puzzle Log's Cognito setup) with the "your
ratings" feature.

## Alternatives considered

- **Sign-in from the start.** More setup before anything useful works, and it would keep
  casual visitors out of data that's public anyway.

## Consequences

- When sign-in arrives, the public routes must stay open (`HttpNoneAuthorizer`) while the
  new ones require a token, and CORS must allow the `authorization` header.

## Explaining it in an interview

"I split the app by data ownership. Public data shipped first with no auth and a throttle
for cost; user data comes later behind Cognito, reusing my other app's setup."
