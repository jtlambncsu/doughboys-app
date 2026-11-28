import { QueryClient, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import type { RatingInput, ReportInput } from '@doughboys-app/shared';
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

export const chainQueryOptions = (api: DoughboysApi, slug: string) =>
  queryOptions({ queryKey: ['chains', 'detail', slug], queryFn: () => api.chain(slug) });

/** Fans' ratings change any time, so they're never kept long. */
export const chainRatingsQueryOptions = (api: DoughboysApi, slug: string) =>
  queryOptions({
    queryKey: ['ratings', 'chain', slug],
    queryFn: () => api.chainRatings(slug),
    staleTime: 0,
  });

/** Everything personal lives under 'me', so signing out clears it in one go. */
export const meQueryOptions = (api: DoughboysApi) =>
  queryOptions({ queryKey: ['me', 'profile'], queryFn: api.me, staleTime: 0 });

export const myRatingsQueryOptions = (api: DoughboysApi) =>
  queryOptions({ queryKey: ['me', 'ratings'], queryFn: api.myRatings, staleTime: 0 });

function useApi() {
  return useRouteContext({ from: '__root__' }).api;
}

export function useSaveProfile() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => api.saveProfile(displayName),
    onSuccess: (profile) => {
      queryClient.setQueryData(['me', 'profile'], profile);
      // Their name appears on their reviews.
      void queryClient.invalidateQueries({ queryKey: ['ratings'] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'ratings'] });
    },
  });
}

/** After a rating changes, refresh what shows it: the chain's ratings, mine, the leaderboard. */
function useRatingChanged() {
  const queryClient = useQueryClient();
  return (slug: string) => {
    void queryClient.invalidateQueries({ queryKey: ['ratings', 'chain', slug] });
    void queryClient.invalidateQueries({ queryKey: ['me', 'ratings'] });
    void queryClient.invalidateQueries({ queryKey: ['chains'], exact: true });
  };
}

export function useRate(slug: string) {
  const api = useApi();
  const changed = useRatingChanged();
  return useMutation({
    mutationFn: (input: RatingInput) => api.rate(slug, input),
    onSuccess: () => changed(slug),
  });
}

export function useDeleteRating(slug: string) {
  const api = useApi();
  const changed = useRatingChanged();
  return useMutation({
    mutationFn: () => api.deleteRating(slug),
    onSuccess: () => changed(slug),
  });
}

export function useReport(slug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ratingId, input }: { ratingId: string; input: ReportInput }) =>
      api.report(slug, ratingId, input),
    // The review may now be hidden.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ratings', 'chain', slug] }),
  });
}

export function useDeleteAccount() {
  const api = useApi();
  return useMutation({ mutationFn: () => api.deleteAccount() });
}

export function createQueryClient() {
  return new QueryClient({
    // Episode data changes about once a day, so there's no need to refetch on every visit.
    defaultOptions: { queries: { staleTime: 10 * 60 * 1000 } },
  });
}
