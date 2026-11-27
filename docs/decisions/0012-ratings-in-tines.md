# 0012. Fan ratings in forks and tines (quarter forks)

- **Status:** Accepted (changes the half-fork step in ADR 0010)
- **Date:** 2026-11-27

## Context

The Doughboys score in forks _and tines_: a fork has four tines, so "3 forks, 1 tine" is 3.25.
Fan ratings allowed only half forks, which didn't match the show's own scale.

## Decision

- Ratings go from 0 to 5 in **quarters** (`TINE = 0.25`, validated in the shared Zod schema).
  Existing half-fork ratings stay valid.
- `forksAndTines()` and `tineLabel()` in `packages/shared` turn a number into the show's
  phrasing: 3.25 → "3 forks, 1 tine".
- A `ForkTines` SVG draws five forks whose tines fill one by one; a fork's head and handle
  fill only when it's whole. It labels itself for screen readers ("3 forks, 1 tine").
- The picker combines a slider (one tine per step), − / + tine buttons for precise taps on a
  phone, and tapping a fork to jump to that many whole forks.

## Alternatives considered

- **Keep halves.** Simpler, but loses the show's vocabulary, which is half the fun.
- **Tap individual tines.** Delightful on a big screen; too small to hit on a phone.
- **A free decimal input.** Precise but joyless, and invites 3.14159.

## Consequences

- Audience averages aren't whole tines; they're shown as numbers (e.g. 4.17), not tines.

## Explaining it in an interview

"The domain had its own unit, so the UI speaks it: scores are stored as numbers but shown and
picked as forks and tines. One shared helper owns the conversion, the schema enforces the
quarter step on both client and server, and the fork graphic doubles as an accessible label."
