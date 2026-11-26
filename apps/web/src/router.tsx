import { createRouter, type RouterHistory } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import type { DoughboysApi } from '@/api/client';
import { routeTree } from './routeTree.gen';

/** What every route can use, injected once: loaders prefetch with it, and tests pass fakes. */
export interface RouterContext {
  queryClient: QueryClient;
  api: DoughboysApi;
}

export function createAppRouter(context: RouterContext, options: { history?: RouterHistory } = {}) {
  return createRouter({
    routeTree,
    context,
    // Loaders hand data to TanStack Query, so the router shouldn't cache it a second time.
    defaultPreloadStaleTime: 0,
    defaultPreload: 'intent',
    scrollRestoration: true,
    ...options,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
