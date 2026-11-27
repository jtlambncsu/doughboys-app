# 0006. Chain logos from Logo.dev, with initials as the fallback

- **Status:** Accepted
- **Date:** 2026-11-27

## Context

A wall of text names wasn't engaging. Logos make the leaderboard scannable, but we can't
host 400 brand logos ourselves, and we only know a chain's website once Claude has
classified it (ADR 0005).

## Decision

- Load logos from **Logo.dev**'s image CDN (`img.logo.dev/<domain>?token=pk_...`) with a
  publishable token, set as `VITE_LOGO_DEV_TOKEN` in Vercel. Publishable tokens are meant
  for browsers; the secret key is never used.
- Credit Logo.dev in the footer, as its free tier asks.
- When there's no token, no known website, or the image fails to load, show a colored badge
  with the chain's initials. The color comes from a hash of the name, so it's stable.
- Logos only identify the chain; they're not the show's branding, and the "unofficial"
  labels stay.

## Alternatives considered

- **Brandfetch:** similar, larger database, more setup.
- **Google's favicon service:** no sign-up, but small, blurry icons and not a supported API.
- **Images from the wiki:** licensing of logos there is unclear and coverage is patchy.

## Consequences

- An external image dependency; the fallback keeps the page usable without it.
- Browsers request images from img.logo.dev directly. Plain `<img>` tags need no CORS change.

## Explaining it in an interview

"Logos come from a logo CDN keyed by the domain that the import's classifier found. The
token is a publishable one designed for the browser, and every logo degrades to a generated
initials badge, so a missing domain or an outage never breaks the layout."
