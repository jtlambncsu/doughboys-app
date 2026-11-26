import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { createDoughboysApi } from '@/api/client';
import { createAppRouter } from '@/router';

/** Renders the whole app at `path`, with a fresh cache and the MSW-backed API. */
export function renderApp(path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter(
    { queryClient, api: createDoughboysApi() },
    { history: createMemoryHistory({ initialEntries: [path] }) },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
