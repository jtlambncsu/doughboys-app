# 0008. New episodes from the official podcast feed, and a daily import

- **Status:** Accepted (changes ADR 0003's weekly schedule to daily)
- **Date:** 2026-11-27

## Context

The fan wiki trails the show: fans write each episode's page by hand, sometimes weeks after
it airs. On 2026-11-27 the wiki's newest main episode was #568 (Nov 5) while the show had
released #569 and #570, so the app looked out of date.

## Decision

- Also read the show's **official RSS feed** (`rss.art19.com/doughboys`), the one podcast apps
  use, with `fast-xml-parser`. Numbered items (`itunes:episode`) are main-show episodes.
- An episode number the wiki doesn't have yet becomes a **feed-only episode**
  (`source: 'feed'`): title, number, date, the description (up to the promo links) as its
  synopsis, and its chain from "…before a review of X", matched to a known chain's spelling
  by slug. No ratings or wiki link; the page says ratings are coming.
- Once the wiki has that number, the wiki's version is used and the feed-only row is
  deleted, even if the titles differ. Matching is by **episode number**, not title.
- Bonus and unlocked episodes (no number) are skipped; the wiki covers them.
- A feed failure is logged and the wiki data is saved anyway.
- The import now runs **daily** at 15:17 UTC: one feed request plus ~25 batched wiki requests.

## Alternatives considered

- **Feed only, no wiki.** Always current, but no ratings, orders or quotes: the core data.
- **Edit the wiki ourselves.** Not our place, and not automatable.
- **Match feed and wiki episodes by title.** Titles differ ("Chipotle 4" vs "Chipotle IV",
  guest order); episode numbers don't.
- **Run every hour.** Episodes come out weekly; daily is plenty and gentler on the wiki.

## Consequences

- New episodes appear within a day of release, then fill in as the wiki catches up.
- A feed-only episode's URL changes when the wiki version replaces it (the slug is the title).
- A new chain named only in the feed may be spelled differently from the wiki's later entry.

## Explaining it in an interview

"Two sources with different strengths: the official feed is timely, the fan wiki is rich but
lags. I merge them by episode number, show feed-only episodes as 'new, ratings coming', and
replace them automatically when the wiki catches up, so the app is never stale and never
shows the same episode twice."
