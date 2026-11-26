import type { Chain, Episode, EpisodeSummary } from '@doughboys-app/shared';

/**
 * Empty in development, so requests go to `/api` on the Vite server, which proxies to the
 * local API. In production this is the API Gateway URL from the CDK output.
 */
const API_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Thin, typed wrapper around `fetch`. TanStack Query (see `queries.ts`) adds caching. */
export function createDoughboysApi() {
  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}/api${path}`);
    if (!res.ok)
      throw new ApiError(
        res.status,
        res.status === 404 ? 'Not found' : `Request failed: ${res.status}`,
      );
    return (await res.json()) as T;
  }

  return {
    episodes: () => get<EpisodeSummary[]>('/episodes'),
    episode: (slug: string) => get<Episode>(`/episodes/${encodeURIComponent(slug)}`),
    chains: () => get<Chain[]>('/chains'),
  };
}

export type DoughboysApi = ReturnType<typeof createDoughboysApi>;
