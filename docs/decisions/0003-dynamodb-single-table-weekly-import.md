# 0003. One DynamoDB table keyed by slug, refreshed by a weekly Lambda

- **Status:** Accepted
- **Date:** 2026-11-26

## Context

About 1,100 episodes, roughly 2 MB in all, changing once a week. The API needs to list
them all, get one, and rank chains.

## Decision

- One table, partition key `slug` (the wiki page title). No sort key, no indexes.
- Listing is a `Scan`, cached in memory for 5 minutes per Lambda container. The leaderboard
  is computed from the list on request (it's ~400 rows).
- A separate import Lambda runs Sundays at 15:17 UTC (EventBridge rule), after the week's
  episode has had a few days of wiki edits. It overwrites episodes with `BatchWrite`.
- The API Lambda can only read the table; only the import Lambda can write.

## Alternatives considered

- **A static JSON file on S3/CloudFront, no API.** Cheaper and simpler for read-only data,
  but signed-in features (your own ratings) are next and need an API and a database anyway.
- **Precomputing the leaderboard into its own item.** Unneeded at this size; easy to add.
- **Single-table design with users, ratings and episodes together.** Worth considering when
  user data arrives (see the next ADR on that).

## Consequences

- Scans read every item; fine at this size and with caching, but not for large tables.
- Episodes removed from the wiki stay in the table until deleted by hand.

## Explaining it in an interview

"The dataset is small and changes weekly, so I kept DynamoDB simple: one table keyed by
slug, a scan cached per Lambda container, and a scheduled Lambda that rewrites the data.
Least privilege: the public API can only read."
