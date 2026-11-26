# 0001. Reuse Puzzle Log's stack and layout

- **Status:** Accepted
- **Date:** 2026-11-26

## Context

This is a second app by the same owner, built to learn and to talk about in interviews.
Puzzle Log already has a working, documented setup: an npm-workspaces monorepo, React 19 +
Vite + Tailwind + shadcn/ui, TanStack Router and Query, Express on Lambda, DynamoDB, CDK, and
GitHub Actions deploys with OIDC.

## Decision

Start from the same stack, layout, lint/format config, test approach and deploy pipeline.
Puzzle Log's ADRs 0001-0014 explain each of those choices; they aren't repeated here.

Left out for now: sign-in (Cognito), photos (S3), the offline PWA and AI features. This app
starts as public, read-only data (see [0004](0004-public-read-only-first.md)).

## Alternatives considered

- **A different stack to learn something new** (Next.js, a hosted database). Would teach
  more breadth, but the interesting new problem here is the data import, and a familiar
  stack keeps the focus on it.
- **A generic "podcast companion" with Blank Check and Doughboys as modules.** A nicer
  story, but more abstraction before either app works. Can be extracted later.

## Consequences

- Fast start: most configuration was copied and already works together.
- Fixes and upgrades in one repo may need repeating in the other.

## Explaining it in an interview

"For my second app I reused the stack from my first on purpose, so the new work went into
the interesting part: importing messy, hand-edited wiki data reliably. The infrastructure
and conventions were already proven and documented."
