# 0005. Classify chains with Claude during the import

- **Status:** Accepted
- **Date:** 2026-11-27

## Context

The wiki's Restaurants list mixes restaurants with grocery stores, packaged and frozen foods,
fruit and vegetables, drinks and one-offs (a wrestling show's catering, a Coke machine). The
leaderboard needs a "restaurants only" view, and logos need each chain's website. The wiki
has no field or category for either.

## Decision

- The weekly import sends chains it hasn't seen before to **Claude** (`claude-opus-5-5`,
  low effort), 40 at a time with a few episode titles each for context. It returns a
  category (restaurant, grocery, packaged_food, produce, drink, other) and the official
  website's domain, or null.
- **Structured outputs** (`messages.parse` with a Zod schema) guarantee the shape; the code
  still drops names it didn't ask about and normalizes domains.
- Results go in a `Chains` DynamoDB table, so each chain is classified once: about 400 at
  first, then a few new ones a week. Cost: cents.
- **Hand overrides** (`apps/api/src/chains/overrides.ts`) are applied whenever chains are
  served, so a wrong label is fixed by a one-line change and a deploy.
- The key lives in SSM Parameter Store (`/doughboys-app/anthropic-api-key`, a SecureString
  created by hand). Only the import Lambda can read it; the public API can't.
- If classification fails, the import still saves episodes, and unclassified chains count as
  restaurants, so the default view is never empty.
- Server-side refusal fallbacks are on (`fallbacks: "default"`), as recommended for this model.

## Alternatives considered

- **A hand-maintained list.** No AI or key, but someone has to keep 400+ entries and their
  websites current.
- **Wikidata** ("instance of: restaurant chain", "official website"). Free, but matching
  names to entities is unreliable and local restaurants are missing.
- **Classifying on every request.** Slow and pays for the same answer repeatedly.

## Consequences

- An AI dependency in the import, but not in serving: the site works if Anthropic is down.
- Labels can be wrong; the overrides file is the fix, and the "Everything" view always
  shows all of them.

## Explaining it in an interview

"The data had no type field, so I used an LLM as a one-time classifier inside the batch
import, not the request path. Structured outputs give a typed result, each chain is labelled
once and cached in DynamoDB, a small overrides file fixes mistakes, and the secret is only
readable by the import job."
