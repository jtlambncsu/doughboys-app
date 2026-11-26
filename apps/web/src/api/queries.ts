import { QueryClient, queryOptions } from '@tanstack/react-query';
import type { DoughboysApi } from './client';

/**
 * Query keys and fetchers in one place. `queryOptions` lets route loaders (prefetch before
 * render) and components (`useSuspenseQuery`) share the exact same definition.
 */
export const episodesQueryOptions = (api: DoughboysApi) =>
  queryOptions({ queryKey: ['episodes', 'list'], queryFn: api.episodes });

export const episodeQueryOptions = (api: DoughboysApi, slug: string) =>
  queryOptions({ queryKey: ['episodes', 'detail', slug], queryFn: () => api.episode(slug) });

export const chainsQueryOptions = (api: DoughboysApi) =>
  queryOptions({ queryKey: ['chains'], queryFn: api.chains });

export function createQueryClient() {
  return new QueryClient({
    // The data changes about once a week, so there's no need to refetch on every visit.
    defaultOptions: { queries: { staleTime: 10 * 60 * 1000 } },
  });
}
