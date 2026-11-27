# Architecture

```
Doughboys Wikia (MediaWiki API)      Official podcast feed (RSS)
        │  daily, ~25 requests                │  daily, 1 request (new episodes)
        ▼                                      ▼
Import Lambda ── parse with wtf_wikipedia ──► DynamoDB (Episodes, keyed by slug)
                                                   ▲
Browser ──► Vercel (React app) ──► API Gateway ──► API Lambda (Express, read-only)
```

## Repo layout (npm workspaces)

| Folder            | What                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `packages/shared` | Zod schemas (`Episode`, `Rating`, `Chain`), fork parsing, the leaderboard |
| `apps/api`        | Express API, the wiki client/parser/importer, DynamoDB store              |
| `apps/web`        | React app: leaderboard, episode list, episode page                        |
| `infra`           | CDK: tables, two Lambdas, HTTP API, daily schedule, GitHub deploy role    |

## Data flow

1. **Import** (`apps/api/src/wiki`). `MediaWikiSource` asks the wiki for every page that
   uses the `InfoboxEp` template, 50 pages per request, with their wikitext. It also reads
   the `Restaurants` list page.
2. **Parse** (`parse.ts`). `wtf_wikipedia` turns wikitext into templates and tables. The
   infobox gives the number, date and guests; the first section with "rating" in its title
   gives a table of who ordered what and their score. The Restaurants list maps each
   episode to the chain it reviewed and the wiki's overall score for it.
3. **Store.** Episodes are written to DynamoDB in batches of 25. Re-running replaces them.
   3b. **Feed.** The official podcast feed adds numbered episodes the wiki doesn't have yet
   (`source: 'feed'`, synopsis only), replaced once the wiki covers them (ADR 0008).
4. **Serve.** The API lists episodes (cached a few minutes per Lambda container), gets one
   by slug, and computes the chain leaderboard from the list (`chainLeaderboard` in shared).
5. **Show.** Route loaders prefetch with TanStack Query; pages read with `useSuspenseQuery`.
   Search and filters live in the URL (`?q=`, `?series=`).

## Episode shape

See `packages/shared/src/episode.ts`. Notable fields:

- `slug`: the wiki page title, used as the id and in URLs.
- `series`: `main` (numbered episodes), `double` (Doughboys Double), `other` (specials).
- `ratings[]`: `person`, `forks` (number or null), `unit` (`forks` or `spoons` for ice cream
  episodes), `raw` (the text as written), `ordered[]`.
- `averageForks`: the wiki's figure from its Restaurants list when there is one, else the
  mean of 0-5 ratings. Can exceed 5 (the wiki's averages include bonus scores).

## Episode details

Besides the infobox and ratings, the parser keeps the rest of each wiki page in
`episode.details` (`parseDetails` in `apps/api/src/wiki/parse.ts`): the synopsis, Nick's
intro, quotes and Roast Spoonman roasts (both from `{{Quote|text|who}}` templates, which every
page uses), the Snack or Wack description, and related episodes (kept only when they're
episodes we have). Details appear only on single-episode responses: lists and the DynamoDB
scan behind them read only the list fields (`ProjectionExpression`).

## Chains

The import labels each new chain with Claude (ADR 0005): `restaurant`, `grocery`,
`packaged_food`, `produce`, `drink` or `other`, plus its website for the logo (ADR 0006).
The leaderboard's **Restaurants** view means anywhere they went to eat, so grocery stores,
gas stations and one-offs count; only products (`packaged_food`, `produce`, `drink`) are
hidden. Unlabelled chains are shown. Hand corrections go in `apps/api/src/chains/overrides.ts`.

## Local development

With no `EPISODES_TABLE` set, the API uses an in-memory store loaded from
`apps/api/data/episodes.json`, which `npm run import:wiki` creates. Vite proxies `/api` to
the local API, so there's no CORS setup locally.

## Testing

- `packages/shared`: unit tests for fork parsing and the leaderboard.
- `apps/api`: parser tests against real wiki page fixtures, importer with a fake wiki,
  DynamoDB store with `aws-sdk-client-mock`, routes with supertest.
- `apps/web`: whole-app tests via `renderApp(path)` with MSW faking the API.
- `infra`: CDK assertions on the synthesized templates.
