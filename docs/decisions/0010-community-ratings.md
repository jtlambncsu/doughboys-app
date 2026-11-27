# 0010. Community ratings: one per fan per chain, audience score from 3 ratings

- **Status:** Accepted
- **Date:** 2026-11-27

## Context

The owner wanted fans to rate the chains the Doughboys reviewed and see a fans' score next
to the boys', like Rotten Tomatoes' critic and audience scores.

## Decision

- **One rating per fan per chain**, editable. The `Ratings` table's key is (chain slug,
  user ID), so the database itself enforces "one each"; a `byUser` index lists a fan's
  ratings and finds them all for account deletion.
- A rating has forks (0-5 in halves), what you ordered, an optional location and a review
  (500 characters). One **shared Zod schema** validates it in the form and in the API.
- **Audience score:** the mean of fans' forks, shown only from **3 ratings**, so one person
  can't define a chain. Computed on read from a cached scan (cleared when a rating changes);
  the table is small.
- **Menu suggestions** for "what did you order": every item the Doughboys ordered at that
  chain plus what fans logged, merged across spelling and case and ranked by count. No
  menu API needed (see ROADMAP).
- **Display names** are stored in a `Profiles` table and copied onto ratings for fast
  reads; renaming updates your ratings. Public responses never include account IDs.
- User data tables have point-in-time recovery and are retained if the stack is deleted.

## Alternatives considered

- **Rating each visit.** Richer, but more to build and a harder audience-score definition.
- **Precomputed aggregates (DynamoDB Streams → a scores table).** Scales better, but
  unnecessary at this size; the read path can switch to it later without changing the API.
- **Showing the average from the first rating.** Easy to skew; Rotten Tomatoes also waits.

## Consequences

- Scanning all ratings for the leaderboard is fine for thousands of ratings, not millions.
- Reviews are public user content: moderation is manual for now (docs/DEPLOYMENT.md).

## Explaining it in an interview

"The key design choice was the table key: (chain, user), so 'one rating per person per
chain' is a database guarantee, not app logic. A secondary index serves 'my ratings' and
account deletion. The audience score is computed on read and hidden under three ratings, and
the same Zod schema validates the form and the API, so the rules can't drift."
