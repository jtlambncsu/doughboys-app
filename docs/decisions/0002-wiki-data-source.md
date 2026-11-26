# 0002. Episode data from the Doughboys Wikia, via its API and wtf_wikipedia

- **Status:** Accepted
- **Date:** 2026-11-26

## Context

The app's core is the fork ratings: who rated each chain what, and what they ordered.
There's no official data source. The podcast's RSS feed has titles and dates but not ratings.
The fan-run [Doughboys Wikia](https://doughboys.fandom.com) has a page for nearly every
episode (about 1,100) with a summary box (number, date, guests) and a ratings table, plus a
`Restaurants` page listing every chain with its overall score. It's edited within days of
new episodes. Its content is licensed CC BY-SA.

## Decision

- Read the wiki through its **MediaWiki API** (`api.php`), not by scraping HTML. Fetch
  every page that uses the `InfoboxEp` template, 50 at a time with their wikitext: about 25
  requests for a full import, with a pause between each.
- Parse the wikitext with **`wtf_wikipedia`**, a popular wikitext parser. Read the infobox
  template for metadata and the first "...rating" section's table for ratings.
- Treat the wiki's tables as hand-edited, inconsistent data. Find the rating by its shape
  ("N forks" or "N spoons") rather than by column position, keep the raw text alongside
  the parsed number, and test against real page fixtures.
- Use the `Restaurants` list for each episode's chain and overall score.
- Credit the wiki and its license in the app's footer and README.

## Alternatives considered

- **Scraping the rendered HTML.** Heavier pages, more fragile selectors, and against the
  spirit of a site that offers an API.
- **Writing a wikitext parser by hand.** Tables with `rowspan`, nested templates and links
  are full of edge cases a maintained library already handles.
- **Entering ratings by hand.** Over 1,000 episodes; not realistic, and it would go stale.
- **Transcribing audio and extracting ratings with an LLM.** Expensive and less accurate
  than fans who already did the work.

## Consequences

- About 560 episodes have parsed ratings. Specials (tournaments, drafts, segment shows)
  often have none or use their own formats; they show "no ratings yet".
- The import has to survive wiki edits: a page's format can change at any time. The weekly
  job logs counts, so a sudden drop is visible.
- CC BY-SA: anything published from this data must credit the wiki and stay under the same
  license.

## Explaining it in an interview

"The data came from a fan wiki, so the hard part was robustness. I used the wiki's API
instead of scraping, a maintained wikitext parser instead of regexes, and I parsed by
shape, not position, because hand-edited tables shift columns. Every parser fix started
with a real page as a test fixture, then I checked it against a full import."
