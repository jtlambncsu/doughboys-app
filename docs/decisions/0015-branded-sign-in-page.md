# 0015. Brand Cognito's sign-in page at deploy time

- **Status:** Accepted
- **Date:** 2026-11-28

## Context

Fans sign in on Cognito's managed login page (ADR 0009), which looked like a generic AWS
page. The owner wanted it to look like the Doughboys App. The rules on the show's branding
still apply: our own name, fork icon and colors, the "unofficial fan app" label, and no
show logos or artwork.

## Decision

- Keep the look in the repo: `infra/branding/settings.json` (colors for light and dark
  mode, button and link colors, the logo above the form) and our SVGs (a logo for light and
  dark mode with "UNOFFICIAL FAN APP", and the fork favicon).
- A CDK custom resource (`infra/lib/branding.ts`, handler `apps/api/src/ops/branding.ts`)
  runs on deploy: it reads Cognito's **full** style for our app client
  (`DescribeManagedLoginBrandingByClient` with merged resources), layers our settings on
  top, and saves it with our images (`UpdateManagedLoginBranding`).
- AWS doesn't publish the settings format as a file and Cognito silently ignores unknown
  keys, so the merge only changes keys that exist and reports any it couldn't place in the
  `LoginBrandingUnknownSettings` stack output (visible in the deploy log). "none" means
  every setting landed.
- Its role can only describe and update this pool's login branding.

## Alternatives considered

- **The console's branding editor.** Easy, but the look isn't in the repo, isn't reviewed,
  and is lost if the style is recreated.
- **Writing the full settings document in CloudFormation.** It must be complete and match a
  schema AWS doesn't publish; a deploy-time merge only needs the parts we change.
- **A custom sign-in page in our app** (Amplify UI, or the Cognito API directly). Full
  control, but we'd handle passwords and passkeys ourselves, undoing ADR 0009's main benefit.
- **A custom domain** (`login.doughboysapp.com`). Nicer address, but it needs a certificate
  and DNS, and changes the passkey domain, which breaks passkeys people already saved.

## Consequences

- If CloudFormation ever recreates the base style (`Auth/LoginBranding`), the branding step
  doesn't re-run by itself; change any file in `infra/branding` to re-apply it.

## Explaining it in an interview

"The hosted login stays AWS's, so we still never touch passwords, but it carries our brand.
Branding is code: a deploy-time custom resource reads Cognito's full style, merges in our
colors and logos from the repo, and reports any setting names AWS didn't recognize, because
that API otherwise ignores typos silently."
