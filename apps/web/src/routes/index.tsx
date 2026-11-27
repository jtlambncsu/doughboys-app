import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Repeat } from 'lucide-react';
import { z } from 'zod';
import type { Chain } from '@doughboys-app/shared';
import { chainsQueryOptions } from '@/api/queries';
import { ChainLogo } from '@/components/ChainLogo';
import { ForkMeter } from '@/components/ForkMeter';
import { ForkScore } from '@/components/ForkScore';
import { ListSkeleton } from '@/components/ListSkeleton';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { rankChains, visitsLabel } from '@/lib/leaderboard';
import { matches } from '@/lib/search';
import { cn } from '@/lib/utils';

const showSchema = z.enum(['restaurants', 'all']);
const sortSchema = z.enum(['rating', 'visits']);

export const Route = createFileRoute('/')({
  // Filters live in the URL, so a view can be shared or bookmarked.
  validateSearch: z.object({
    q: z.string().optional(),
    show: showSchema.optional(),
    sort: sortSchema.optional(),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(chainsQueryOptions(context.api)),
  pendingComponent: ListSkeleton,
  component: Leaderboard,
});

type RankedChain = Chain & { rank: number };

const MEDALS = ['🥇', '🥈', '🥉'];

function Leaderboard() {
  const { api } = Route.useRouteContext();
  const { q = '', show = 'restaurants', sort = 'rating' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: chains } = useSuspenseQuery(chainsQueryOptions(api));

  const ranked = rankChains(chains, show, sort);
  const searching = q.trim() !== '';
  const shown = ranked.filter((chain) => matches(q, chain.name));
  // The podium is for browsing; while searching, show plain results.
  const podium = searching ? [] : shown.slice(0, 3);
  const rest = searching ? shown : shown.slice(3);

  const setSearch = (next: { q?: string; show?: string; sort?: string }) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        ...('q' in next && { q: next.q || undefined }),
        ...(next.show && {
          show: next.show === 'restaurants' ? undefined : showSchema.parse(next.show),
        }),
        ...(next.sort && {
          sort: next.sort === 'rating' ? undefined : sortSchema.parse(next.sort),
        }),
      }),
      replace: true,
    });

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Leaderboard</h1>
        <p className="text-muted-foreground text-sm">
          {sort === 'visits'
            ? 'The places the Doughboys keep going back to.'
            : 'Every chain the Doughboys have reviewed, by average fork rating.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={show}
          onValueChange={(value) => value && setSearch({ show: value })}
          aria-label="Which places"
        >
          <ToggleGroupItem value="restaurants">Restaurants</ToggleGroupItem>
          <ToggleGroupItem value="all">Everything</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={sort}
          onValueChange={(value) => value && setSearch({ sort: value })}
          aria-label="Sort by"
        >
          <ToggleGroupItem value="rating">Top rated</ToggleGroupItem>
          <ToggleGroupItem value="visits">Most visited</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Input
        type="search"
        aria-label="Search chains"
        placeholder="Search chains"
        value={q}
        onChange={(e) => setSearch({ q: e.target.value })}
      />

      {shown.length === 0 && (
        <p className="text-muted-foreground py-8 text-center">No chains match “{q}”.</p>
      )}

      {podium.length > 0 && (
        <ol aria-label="Top three" className="grid grid-cols-3 gap-2">
          {podium.map((chain) => (
            <li key={chain.name}>
              <PodiumCard chain={chain} sort={sort} />
            </li>
          ))}
        </ol>
      )}

      {rest.length > 0 && (
        <ol className="divide-y rounded-xl border" aria-label="Chains">
          {rest.map((chain) => (
            <li key={chain.name}>
              <ChainRow chain={chain} sort={sort} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function VisitsBadge({ visits, emphasized }: { visits: number; emphasized?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs whitespace-nowrap',
        emphasized ? 'text-foreground font-medium' : 'text-muted-foreground',
      )}
    >
      <Repeat className="size-3" aria-hidden />
      {visitsLabel(visits)}
    </span>
  );
}

function PodiumCard({ chain, sort }: { chain: RankedChain; sort: string }) {
  return (
    <Link
      to="/episodes/$slug"
      params={{ slug: chain.latestEpisode }}
      className="bg-card hover:bg-accent relative flex h-full flex-col items-center gap-1.5 rounded-xl border px-2 pt-4 pb-3 text-center transition-colors"
    >
      <span className="absolute top-1.5 left-2 text-lg" aria-label={`Rank ${chain.rank}`}>
        {MEDALS[chain.rank - 1]}
      </span>
      <ChainLogo name={chain.name} domain={chain.domain} size={48} />
      <span className="line-clamp-2 text-sm leading-tight font-medium">{chain.name}</span>
      <span className="mt-auto w-full space-y-1">
        <ForkScore value={chain.averageForks} />
        <ForkMeter value={chain.averageForks} />
        <VisitsBadge visits={chain.visits} emphasized={sort === 'visits'} />
      </span>
    </Link>
  );
}

function ChainRow({ chain, sort }: { chain: RankedChain; sort: string }) {
  return (
    <Link
      to="/episodes/$slug"
      params={{ slug: chain.latestEpisode }}
      className="hover:bg-accent flex items-center gap-3 px-3 py-2.5"
    >
      <span className="text-muted-foreground w-7 text-right text-sm tabular-nums">
        {chain.rank}
      </span>
      <ChainLogo name={chain.name} domain={chain.domain} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{chain.name}</span>
        <VisitsBadge visits={chain.visits} emphasized={sort === 'visits'} />
      </span>
      <span className="flex w-20 shrink-0 flex-col items-end gap-1">
        <ForkScore value={chain.averageForks} />
        <ForkMeter value={chain.averageForks} />
      </span>
    </Link>
  );
}
