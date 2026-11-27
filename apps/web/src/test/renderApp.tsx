import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { vi } from 'vitest';
import { createDoughboysApi } from '@/api/client';
import { FanAuthContext, type FanAuth } from '@/auth/fan';
import { Toaster } from '@/components/ui/sonner';
import { createAppRouter } from '@/router';

/** The fake API (test/server.ts) treats this token as the signed-in test fan. */
export const TEST_TOKEN = 'test-token';

export interface RenderOptions {
  /** Signed in as the test fan (default), or signed out. */
  signedIn?: boolean;
}

/** Renders the whole app at `path`, with a fresh cache and the MSW-backed API. */
export function renderApp(path = '/', { signedIn = true }: RenderOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const fan: FanAuth = {
    status: signedIn ? 'signedIn' : 'signedOut',
    ...(signedIn && { email: 'fan@example.com' }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    forget: vi.fn(async () => {}),
  };
  const router = createAppRouter(
    { queryClient, api: createDoughboysApi(async () => (signedIn ? TEST_TOKEN : undefined)) },
    { history: createMemoryHistory({ initialEntries: [path] }) },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <FanAuthContext.Provider value={fan}>
        <RouterProvider router={router} />
        <Toaster />
      </FanAuthContext.Provider>
    </QueryClientProvider>,
  );
  return { router, queryClient, fan };
}
