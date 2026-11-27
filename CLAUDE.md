# Working on Doughboys App (doughboys-app)

Context for AI assistants (and humans) picking up this repo. Read `docs/ARCHITECTURE.md` first.
This is a sibling of the owner's Puzzle Log app and deliberately uses the same stack and
conventions; when in doubt, do what Puzzle Log does.

## Owner's goals

- Learning modern React and full-stack patterns for interviews: prefer **popular, current
  libraries** and idiomatic patterns over custom code.
- The owner often works from a phone: keep explanations clear and plain, and give
  copy-pasteable commands for anything they need to run (AWS CloudShell works well).
- **Document decisions.** For any significant choice (a new library, a pattern, an
  infrastructure change), add an ADR in `docs/decisions/` (copy `0000-template.md`, take the
  next number, add it to the index). Include the alternatives and an "explaining it in an
  interview" section. Add real debugging stories to `docs/lessons-learned.md`.

## Stack (see ADRs for why)

- Web: React 19, Vite, Tailwind v4, shadcn/ui (Radix), TanStack Router (file-based routes in
  `apps/web/src/routes`), TanStack Query (`apps/web/src/api/queries.ts`).
- API: Express 5 on Lambda; DynamoDB behind the `EpisodeStore` interface with an in-memory fake.
- Data: imported from the Doughboys Wikia's MediaWiki API and parsed with `wtf_wikipedia`
  (`apps/api/src/wiki`), plus new episodes from the official podcast feed (`apps/api/src/feed`,
  `fast-xml-parser`) until the wiki covers them. A scheduled Lambda re-imports daily.
- Chains: Claude (`@anthropic-ai/sdk`, structured outputs) classifies new chains during the
  import (`apps/api/src/chains`); hand fixes go in `chains/overrides.ts`. The key is in SSM
  (`/doughboys-app/anthropic-api-key`) and never in code, env files or chat. Tests use fakes.
- Logos: Logo.dev image CDN with a publishable token (`VITE_LOGO_DEV_TOKEN`); initials badge
  fallback (`ChainLogo`).
- Fans: Cognito managed login (passwords + passkeys, ADR 0009) with `react-oidc-context`;
  ratings and profiles in DynamoDB (ADR 0010), routes in `apps/api/src/routes/fans.ts`.
- Guardrails (ADR 0013): daily sign-up cap (Cognito pre sign-up trigger), hourly stats,
  CloudWatch dashboard, email alarms and an AWS Budget (`infra/lib/ops.ts`, `apps/api/src/ops`).
- Ideas for later are in `docs/ROADMAP.md`.
- Shared: Zod schemas and pure logic in `packages/shared` (consumed as TypeScript source).
- Infra: AWS CDK in `infra/`, deployed by GitHub Actions on pushes to `main` using OIDC.

## Conventions

- Before pushing: `npm run format && npm run lint && npm run typecheck && npm test && npm run build`.
- Add shadcn components from `apps/web` with `npx shadcn@latest add <name>`; don't hand-write
  them. Files in `src/components/ui` are generated code.
- Web tests render the app with `renderApp(path)` and fake the API with MSW
  (`src/test/server.ts`). Prefer queries by role/label.
- Parser changes need a fixture from a real wiki page in `apps/api/src/wiki/fixtures` and a
  test. Wiki pages are hand-edited by fans and vary a lot; check a change against a full
  import (`npm run import:wiki`) and look at the counts it prints.
- Be gentle with the wiki: batch requests (50 pages each), pause between them, and never run
  imports in tests or CI.
- Credit the wiki (CC BY-SA) wherever its data is shown. The name "Doughboys App" must
  always appear with "Unofficial fan app" next to it (header, page title), and the footer's
  "not affiliated" note stays. Don't use the show's logos or artwork.
- TypeScript is pinned to 6.0 until typescript-eslint supports 7.
- Every fan-data access is scoped to the signed-in user (`res.locals.userId`, from the
  verified token): never take a user ID from the body or URL, and never return account IDs in
  public responses. Routes about "me" need both the API Gateway JWT route (infra) and
  `requireUser` (API); infra tests check the former.
- Stateful AWS resources are `RETAIN`ed; changing a DynamoDB key schema creates a new table.
- API code is bundled to CommonJS for Lambda: don't use `import.meta` in `apps/api/src`.
- After infra changes deploy, verify against the live API (e.g. `curl` health and
  `/api/chains`, CORS preflight 2xx).
- New HTTP methods or request headers in the web client must also be added to API Gateway's
  `corsPreflight`. Tests can't catch this.
- In the cloud sandbox, Node's `fetch` ignores the proxy: run the import with
  `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npm run import:wiki`.
- The sandbox also needs `rss.art19.com` (the podcast feed) for a full local import.
