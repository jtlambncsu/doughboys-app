import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { chainsQueryOptions } from '@/api/queries';
import { ForkScore } from '@/components/ForkScore';
import { ListSkeleton } from '@/components/ListSkeleton';
import { Input } from '@/components/ui/input';
import { matches } from '@/lib/search';

export const Route = createFileRoute('/')({
  // The search box lives in the URL, so a filtered view can be shared or bookmarked.
  validateSearch: z.object({ q: z.string().optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(chainsQueryOptions(context.api)),
  pendingComponent: ListSkeleton,
  component: Leaderboard,
});

function Leaderboard() {
  const { api } = Route.useRouteContext();
  const { q = '' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: chains } = useSuspenseQuery(chainsQueryOptions(api));

  // Rank against the full list, so filtering keeps each chain's real position.
  const ranked = chains.map((chain, index) => ({ ...chain, rank: index + 1 }));
  const shown = ranked.filter((chain) => matches(q, chain.name));

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Leaderboard</h1>
        <p className="text-muted-foreground text-sm">
          Every chain the Doughboys have reviewed, by average fork rating.
        </p>
      </div>
      <Input
        type="search"
        aria-label="Search chains"
        placeholder="Search chains"
        value={q}
        onChange={(e) =>
          void navigate({ search: { q: e.target.value || undefined }, replace: true })
        }
      />
      {shown.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No chains match “{q}”.</p>
      ) : (
        <ol className="divide-y rounded-lg border" aria-label="Chains">
          {shown.map((chain) => (
            <li key={chain.name}>
              <Link
                to="/episodes/$slug"
                params={{ slug: chain.latestEpisode }}
                className="hover:bg-accent flex items-center gap-3 px-3 py-2.5"
              >
                <span className="text-muted-foreground w-8 text-right text-sm tabular-nums">
                  {chain.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{chain.name}</span>
                  {chain.episodeCount > 1 && (
                    <span className="text-muted-foreground text-xs">
                      {chain.episodeCount} visits
                    </span>
                  )}
                </span>
                <ForkScore value={chain.averageForks} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
