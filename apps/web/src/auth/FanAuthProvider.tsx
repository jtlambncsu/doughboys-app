import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from 'react-oidc-context';
import type { User } from 'oidc-client-ts';
import { authEnabled, cognitoLogoutUrl, userManager } from './config';
import { FanAuthContext, type FanAuth } from './fan';

/** Local development without Cognito: always signed in as the local API's dev fan. */
const localDevFan: FanAuth = {
  status: 'signedIn',
  email: 'local-dev@example.com',
  signIn: () => {},
  signOut: () => {},
  forget: async () => {},
};

function CognitoFan({ children, onSignOut }: { children: ReactNode; onSignOut: () => void }) {
  const auth = useAuth();
  const fan: FanAuth = {
    status: auth.isLoading ? 'loading' : auth.isAuthenticated ? 'signedIn' : 'signedOut',
    email: auth.user?.profile.email,
    signIn: () =>
      void auth.signinRedirect({
        state: { returnTo: window.location.pathname + window.location.search },
      }),
    signOut: () => {
      void (async () => {
        onSignOut();
        await auth.removeUser(); // forget tokens locally…
        window.location.assign(cognitoLogoutUrl()); // …and end the Cognito session too
      })();
    },
    forget: async () => {
      onSignOut();
      await auth.removeUser();
    },
  };
  return <FanAuthContext.Provider value={fan}>{children}</FanAuthContext.Provider>;
}

/**
 * Provides `useFan()` to the app. `onSignIn` gets the page to return to after Cognito
 * redirects back; `onSignOut` clears cached personal data.
 */
export function FanAuthProvider({
  children,
  onSignIn,
  onSignOut,
}: {
  children: ReactNode;
  onSignIn: (returnTo: string) => void;
  onSignOut: () => void;
}) {
  if (!authEnabled || !userManager) {
    return <FanAuthContext.Provider value={localDevFan}>{children}</FanAuthContext.Provider>;
  }
  return (
    <AuthProvider
      userManager={userManager}
      onSigninCallback={(user: User | undefined) => {
        // Cognito redirects back with ?code=…; drop it and return to where they were.
        const state = user?.state as { returnTo?: string } | undefined;
        const returnTo = state?.returnTo?.startsWith('/') ? state.returnTo : '/';
        window.history.replaceState({}, document.title, returnTo);
        onSignIn(returnTo);
      }}
    >
      <CognitoFan onSignOut={onSignOut}>{children}</CognitoFan>
    </AuthProvider>
  );
}
