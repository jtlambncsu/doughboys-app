# 0011. Drop "what I ordered" from fan ratings

- **Status:** Accepted (supersedes the order and menu parts of ADR 0010)
- **Date:** 2026-11-27

## Context

ADR 0010 gave each fan rating a list of ordered items, picked from a menu built from the
Doughboys' and fans' orders. But a fan rates a chain once (one score per restaurant), not a
visit, so a single order list doesn't describe what the score is about. Using it, the owner
found it didn't make sense.

## Decision

- A rating is forks (0-5 in halves), an optional location and an optional review.
- The order picker, the `GET /api/chains/:slug/menu` endpoint and the menu-building code
  are removed.
- The API ignores an `ordered` field if a client sends one, and never returns order lists
  saved before this change. They disappear from storage the next time that fan re-saves.

## Alternatives considered

- **Reframe it as your "go-to order"** at the chain. Fits one rating per chain, but adds a
  field few people would fill in.
- **Rate each visit**, with its own order and score. The order makes sense there, but it's a
  new data model and a migration; revisit if fans ask for visit logs (see ROADMAP).

## Consequences

- A shorter rating form, and less code.
- Old ratings may still hold an unused `ordered` attribute in DynamoDB until re-saved.

## Explaining it in an interview

"We shipped an order picker and removed it the same day. With one rating per chain, the order
didn't belong to anything. The API stays backward compatible: it ignores the old field on
input and never returns it, so no migration was needed."
