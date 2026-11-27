# Architecture Decision Records

An ADR is a short note recording one significant decision: the context, what we chose,
what we rejected and why, and the consequences. They're append-only: when a decision
changes, write a new ADR that supersedes the old one rather than editing history.

New decision? Copy [`0000-template.md`](0000-template.md) to the next number.

| #                                                   | Decision                                                        |
| --------------------------------------------------- | --------------------------------------------------------------- |
| [0001](0001-reuse-puzzle-log-stack.md)              | Reuse Puzzle Log's stack and layout                             |
| [0002](0002-wiki-data-source.md)                    | Episode data from the Doughboys Wikia, via its API              |
| [0003](0003-dynamodb-single-table-weekly-import.md) | One DynamoDB table keyed by slug, refreshed weekly              |
| [0004](0004-public-read-only-first.md)              | Public, read-only first; sign-in later                          |
| [0005](0005-classify-chains-with-claude.md)         | Classify chains with Claude during the import                   |
| [0006](0006-logos-from-logo-dev.md)                 | Chain logos from Logo.dev, initials as fallback                 |
| [0007](0007-chain-pages-and-score-chart.md)         | Chain pages with a score-over-time chart (Recharts)             |
| [0008](0008-podcast-feed-for-new-episodes.md)       | New episodes from the podcast feed; daily import                |
| [0009](0009-fan-accounts-cognito.md)                | Fan accounts: Cognito managed login, passwords and passkeys     |
| [0010](0010-community-ratings.md)                   | Community ratings: one per fan per chain, audience score from 3 |
| [0011](0011-drop-orders-from-fan-ratings.md)        | Drop "what I ordered" from fan ratings                          |
| [0012](0012-ratings-in-tines.md)                    | Fan ratings in forks and tines (quarter forks)                  |
| [0013](0013-cost-and-abuse-guardrails.md)           | Guardrails against bots and surprise bills; stats dashboard     |
