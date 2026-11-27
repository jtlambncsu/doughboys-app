import { createContext, useContext } from 'react';

/** Who's using the app: someone signed in, or not. Browsing never needs it. */
export interface FanAuth {
  status: 'loading' | 'signedOut' | 'signedIn';
  email?: string;
  /** Goes to Cognito's sign-in page, then comes back to the current page. */
  signIn: () => void;
  signOut: () => void;
  /** After deleting the account: forget it locally without visiting Cognito. */
  forget: () => Promise<void>;
}

export const signedOutFan: FanAuth = {
  status: 'signedOut',
  signIn: () => {},
  signOut: () => {},
  forget: async () => {},
};

export const FanAuthContext = createContext<FanAuth>(signedOutFan);

export function useFan() {
  return useContext(FanAuthContext);
}
