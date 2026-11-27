# 0007. Chain pages with a score-over-time chart (Recharts)

- **Status:** Accepted
- **Date:** 2026-11-27

## Context

100 chains were reviewed more than once (McDonald's 25 times, Taco Bell 23), but the
leaderboard linked only to the latest episode, hiding how opinions changed over the years.

## Decision

- A page per chain at `/chains/<name>`, fed by `GET /api/chains/:name`, which returns the
  chain's summary and every episode that featured it (one DynamoDB `BatchGet`).
- The leaderboard and each episode's restaurant name link there.
- Rated visits are listed newest first, numbered, with the change since the previous visit
  and each person's score. Episodes without a score for the chain (tournaments, drafts)
  are listed separately as "Also featured in".
- With two or more rated visits, a **Recharts** line chart shows the score over time:
  one series (no legend), straight segments (scores exist only at visits), 8px markers, a
  tooltip per visit, a y-axis starting one step below the lowest score, and a color token
  validated for contrast in light and dark mode. The visit list doubles as its table view.

## Alternatives considered

- **Keep linking to the latest episode.** Simple, but hides the most interesting data.
- **A hand-drawn SVG sparkline.** Lighter, but no tooltips or axes; Recharts is the popular
  React choice and Puzzle Log already uses it.
- **Smoothed (monotone) lines.** Look nicer but invent scores between visits.

## Consequences

- Recharts adds to the web bundle; it's only loaded on chain pages (route code splitting).
- Chain names are URL path segments, so they're always encoded (`Which Wich?`).

## Explaining it in an interview

"Each chain gets a page with every visit and a score-over-time chart. The API batches the
reads, the list doubles as the chart's accessible table, and I followed a few charting rules:
one series means no legend, straight lines because data only exists at each visit, and an
axis range that makes real differences visible."
