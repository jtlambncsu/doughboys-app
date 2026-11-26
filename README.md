# Doughboys App (unofficial)

Live at [doughboysapp.com](https://doughboysapp.com).

An unofficial, fan-made companion to the [Doughboys](https://www.doughboyspod.com) podcast:
every chain the boys have reviewed, ranked by fork rating, with what everyone ordered.

Episode data comes from the [Doughboys Wikia](https://doughboys.fandom.com), whose content is
licensed [CC BY-SA](https://www.fandom.com/licensing). Thanks to the fans who keep it up to
date. This project isn't affiliated with Doughboys, its hosts or Headgum.

## Run it locally

```bash
npm install
# Download every episode from the wiki into apps/api/data/episodes.json (about 30 seconds).
npm run import:wiki
npm run dev   # web on http://localhost:5173, API on http://localhost:3001
```

## Checks

```bash
npm run format && npm run lint && npm run typecheck && npm test && npm run build
```

## Docs

- [Architecture](docs/ARCHITECTURE.md): how the pieces fit together.
- [Deployment](docs/DEPLOYMENT.md): AWS and Vercel setup.
- [Decisions](docs/decisions/README.md): why things are the way they are.
- [Lessons learned](docs/lessons-learned.md): real bugs and how they were found.

Code is GPL-3.0 (see [LICENSE](LICENSE)). Wiki-derived data stays CC BY-SA.
