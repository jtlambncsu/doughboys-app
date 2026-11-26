# Architecture Decision Records

An ADR is a short note recording one significant decision: the context, what we chose,
what we rejected and why, and the consequences. They're append-only: when a decision
changes, write a new ADR that supersedes the old one rather than editing history.

New decision? Copy [`0000-template.md`](0000-template.md) to the next number.

| #                                                   | Decision                                           |
| --------------------------------------------------- | -------------------------------------------------- |
| [0001](0001-reuse-puzzle-log-stack.md)              | Reuse Puzzle Log's stack and layout                |
| [0002](0002-wiki-data-source.md)                    | Episode data from the Doughboys Wikia, via its API |
| [0003](0003-dynamodb-single-table-weekly-import.md) | One DynamoDB table keyed by slug, refreshed weekly |
| [0004](0004-public-read-only-first.md)              | Public, read-only first; sign-in later             |
