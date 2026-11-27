import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

const authority = import.meta.env.VITE_COGNITO_AUTHORITY as string | undefined;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
const domain = import.meta.env.VITE_COGNITO_DOMAIN as string | undefined;

/**
 * Sign-in is on when the Cognito settings are present (Vercel, or a local `.env.local`).
 * Without them (local development) the app acts as one fixed "local dev" fan, matching
 * the local API.
 */
export const authEnabled = Boolean(authority && clientId && domain);

/**
 * Talks to Cognito with OpenID Connect: the authorization code flow with PKCE, so there's
 * no client secret in the browser. Tokens refresh in the background with the refresh token.
 * Passwords and passkeys are handled entirely on Cognito's sign-in page.
 */
export const userManager = authEnabled
  ? new UserManager({
      authority: authority!,
      client_id: clientId!,
      redirect_uri: window.location.origin,
      post_logout_redirect_uri: window.location.origin,
      response_type: 'code',
      scope: 'openid email profile',
      automaticSilentRenew: true,
      // Keeps you signed in across tabs and restarts. Tradeoff: a script running on the
      // page (an XSS bug) could read the tokens. React escapes all text we render, and we
      // render no HTML from users or the wiki, which keeps that risk low. ADR 0009.
      userStore: new WebStorageStateStore({ store: window.localStorage }),
    })
  : null;

/** Gets a valid access token, refreshing it first if it has expired. */
export async function getAccessToken() {
  if (!userManager) return undefined;
  let user = await userManager.getUser();
  if (user?.expired) user = await userManager.signinSilent().catch(() => null);
  return user?.access_token;
}

/** Cognito's logout endpoint isn't in its OIDC discovery document, so build it by hand. */
export function cognitoLogoutUrl() {
  const params = new URLSearchParams({ client_id: clientId!, logout_uri: window.location.origin });
  return `${domain}/logout?${params}`;
}
