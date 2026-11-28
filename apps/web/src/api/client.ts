import type {
  Chain,
  ChainDetail,
  ChainRatings,
  Episode,
  EpisodeSummary,
  FanRating,
  MyRating,
  Profile,
  RatingInput,
  ReportInput,
} from '@doughboys-app/shared';

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

function messageFor(status: number, body: unknown) {
  const error = (body as { error?: string; issues?: { message: string }[] } | null) ?? {};
  if (status === 400 && error.issues?.length) return error.issues[0]!.message;
  if (status === 401) return 'Your session has expired. Sign in again.';
  if (status === 404) return 'Not found';
  if ((status === 409 || status === 400) && error.error) return error.error;
  return `Request failed: ${status}`;
}

/** Returns the signed-in fan's access token, or undefined when nobody is signed in. */
export type GetAccessToken = () => Promise<string | undefined>;

/**
 * Thin, typed wrapper around `fetch`. TanStack Query (see `queries.ts`) adds caching.
 * The access token is only sent to the routes about "me"; browsing is anonymous.
 */
export function createDoughboysApi(getAccessToken: GetAccessToken = async () => undefined) {
  async function request<T>(
    path: string,
    {
      method = 'GET',
      body,
      auth = false,
    }: { method?: string; body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const token = await getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new ApiError(res.status, messageFor(res.status, errorBody));
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  const chainPath = (slug: string) => `/chains/${encodeURIComponent(slug)}`;

  return {
    episodes: () => request<EpisodeSummary[]>('/episodes'),
    episode: (slug: string) => request<Episode>(`/episodes/${encodeURIComponent(slug)}`),
    chains: () => request<Chain[]>('/chains'),
    chain: (slug: string) => request<ChainDetail>(chainPath(slug)),
    chainRatings: (slug: string) => request<ChainRatings>(`${chainPath(slug)}/ratings`),

    me: () => request<Profile>('/me', { auth: true }),
    saveProfile: (displayName: string) =>
      request<Profile>('/me', { method: 'PUT', body: { displayName }, auth: true }),
    myRatings: () => request<MyRating[]>('/me/ratings', { auth: true }),
    rate: (slug: string, input: RatingInput) =>
      request<FanRating>(`${chainPath(slug)}/rating`, { method: 'PUT', body: input, auth: true }),
    deleteRating: (slug: string) =>
      request<void>(`${chainPath(slug)}/rating`, { method: 'DELETE', auth: true }),
    deleteAccount: () => request<void>('/me', { method: 'DELETE', auth: true }),
    report: (slug: string, ratingId: string, input: ReportInput) =>
      request<{ hidden: boolean }>(
        `${chainPath(slug)}/ratings/${encodeURIComponent(ratingId)}/report`,
        { method: 'POST', body: input, auth: true },
      ),
  };
}

export type DoughboysApi = ReturnType<typeof createDoughboysApi>;
