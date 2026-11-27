# 0009. Fan accounts: Cognito managed login, passwords and passkeys

- **Status:** Accepted (supersedes the "no sign-in" part of ADR 0004)
- **Date:** 2026-11-27

## Context

Fans can now rate chains (ADR 0010), so they need accounts. The owner asked for the most
careful option. Browsing must stay public.

## Decision

- **Amazon Cognito with its managed login page**, as in Puzzle Log but with **self sign-up**.
  Sign-up, sign-in, email verification and password resets happen on AWS's page; the app
  and its database never see a password.
- **Passwords and passkeys** (`allowedFirstAuthFactors: password + passkey`, Essentials
  tier). Passkeys (Face ID / Touch ID) are phishing-resistant. Passwords need 12+ characters
  and no composition rules, per NIST SP 800-63B.
- **Email must be verified** before an account can sign in. Errors don't reveal whether an
  email has an account (`preventUserExistenceErrors`).
- **OAuth authorization code flow with PKCE** via `oidc-client-ts` / `react-oidc-context`:
  no client secret in the browser. Access tokens last 1 hour; refresh tokens 30 days and can
  be revoked.
- **Tokens are checked twice:** API Gateway's JWT authorizer on every route about "me"
  (`/api/me`, `/api/me/ratings`, `PUT|DELETE /api/chains/{slug}/rating`), then Express's
  `requireUser`. The user ID always comes from the verified token (`sub`), never the request.
  The app defaults to "nobody signed in", so a misconfiguration fails closed.
- **Minimal data:** we store the Cognito `sub` and a chosen display name. Emails stay in
  Cognito and are never shown to others.
- **Account deletion** removes ratings, profile and the Cognito user (`AdminDeleteUser`, the
  only Cognito permission the API has).
- The user pool has deletion protection and is retained if the stack is deleted.

## Alternatives considered

- **Google (or Apple) sign-in.** Convenient, not more secure, and needs a Google Cloud
  project and consent-screen review. Can be added later as an identity provider.
- **Our own auth (Auth.js, Lucia, hand-rolled).** Means storing password hashes and
  building resets and verification ourselves: more risk for no gain.
- **Auth0 / Clerk.** Polished, but another vendor and account; Cognito is already in the
  AWS account and the owner's other app.
- **Tokens in memory only.** Safer against XSS, but you'd sign in on every visit. We keep
  them in localStorage, and keep XSS risk low by never rendering HTML from users or the wiki.

## Consequences

- New Vercel settings (`VITE_COGNITO_*`) and Cognito's free tier limits apply.
- Sign-up abuse is limited by email verification, one rating per chain per account, API
  throttling, and the 3-rating minimum before an audience score shows. CAPTCHA or Cognito's
  threat protection (Plus tier) are options if spam appears.

## Explaining it in an interview

"I didn't build auth. Cognito's hosted login does sign-up, verification, passwords and
passkeys, and the app uses the code flow with PKCE. API Gateway validates the JWT on the
personal routes, the API re-checks it, and every query is scoped to the token's `sub`, so a
fan can only ever touch their own data. We store an anonymous ID and a display name, and
'delete my account' really deletes everything."
