import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp } from 'lucide-react';
import type { Episode } from '@doughboys-app/shared';
import { chainQueryOptions } from '@/api/queries';
import { ChainLogo } from '@/components/ChainLogo';
import { ForkMeter } from '@/components/ForkMeter';
import { ForkScore } from '@/components/ForkScore';
import { ListSkeleton } from '@/components/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { ScoreChart } from '@/features/chains/ScoreChart';
import { episodeLabel, formatDate } from '@/lib/format';
import { visitsLabel } from '@/lib/leaderboard';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/chains/$slug')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(chainQueryOptions(context.api, params.slug)),
  pendingComponent: ListSkeleton,
  component: ChainPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  grocery: 'Store',
  packaged_food: 'Packaged food',
  produce: 'Produce',
  drink: 'Drink',
  other: 'Other',
};

function ChainPage() {
  const { api } = Route.useRouteContext();
  const { slug } = Route.useParams();
  const { data: chain } = useSuspenseQuery(chainQueryOptions(api, slug));

  const rated = chain.episodes.filter((e) => e.averageForks !== undefined);
  const mentions = chain.episodes.filter((e) => e.averageForks === undefined).reverse();
  // Newest first, each with its visit number and the change since the visit before.
  const visits = rated
    .map((episode, i) => ({
      episode,
      number: i + 1,
      change: i > 0 ? episode.averageForks! - rated[i - 1]!.averageForks! : undefined,
    }))
    .reverse();
  const categoryLabel = chain.category && CATEGORY_LABELS[chain.category];

  return (
    <article className="space-y-5">
      <Link to="/" className="text-muted-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> Leaderboard
      </Link>

      <header className="flex items-center gap-4">
        <ChainLogo name={chain.name} domain={chain.domain} size={64} />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="font-heading text-2xl leading-tight font-semibold">{chain.name}</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            {categoryLabel && <Badge variant="secondary">{categoryLabel}</Badge>}
            <span>
              {visitsLabel(chain.visits)}
              {chain.ratedVisits !== chain.visits && ` · ${chain.ratedVisits} rated`}
            </span>
          </p>
        </div>
        {chain.averageForks !== undefined && (
          <div className="w-20 shrink-0 space-y-1 text-right">
            <ForkScore value={chain.averageForks} />
            <ForkMeter value={chain.averageForks} />
          </div>
        )}
      </header>

      {rated.length >= 2 && <ScoreChart episodes={chain.episodes} />}

      {visits.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold">
            {visits.length === 1 ? 'The visit' : 'Every rated visit'}
          </h2>
          <ol aria-label="Rated visits" className="space-y-2">
            {visits.map(({ episode, number, change }) => (
              <li key={episode.slug}>
                <VisitCard
                  episode={episode}
                  number={visits.length > 1 ? number : undefined}
                  change={change}
                />
              </li>
            ))}
          </ol>
        </section>
      )}

      {mentions.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold">Also featured in</h2>
          <p className="text-muted-foreground text-sm">
            Episodes without a fork rating for it, like tournaments, drafts and specials.
          </p>
          <ul aria-label="Other episodes" className="divide-y rounded-xl border">
            {mentions.map((episode) => (
              <li key={episode.slug}>
                <Link
                  to="/episodes/$slug"
                  params={{ slug: episode.slug }}
                  className="hover:bg-accent block px-3 py-2"
                >
                  <span className="block truncate text-sm font-medium">{episode.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {episodeLabel(episode.number, episode.series)} ·{' '}
                    {formatDate(episode.releaseDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Change({ value }: { value: number }) {
  if (Math.abs(value) < 0.005) {
    return <span className="text-muted-foreground text-xs">Same as last time</span>;
  }
  const up = value > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className="text-muted-foreground inline-flex items-center gap-0.5 text-xs">
      <Icon className="size-3" aria-hidden />
      {up ? 'Up' : 'Down'}{' '}
      {Math.abs(value)
        .toFixed(2)
        .replace(/\.?0+$/, '')}{' '}
      from last visit
    </span>
  );
}

function VisitCard({
  episode,
  number,
  change,
}: {
  episode: Episode;
  number?: number;
  change?: number;
}) {
  return (
    <Link
      to="/episodes/$slug"
      params={{ slug: episode.slug }}
      className="bg-card hover:bg-accent block rounded-xl border p-3 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs">
            {number !== undefined && (
              <span className="text-foreground font-medium">Visit {number} · </span>
            )}
            {episodeLabel(episode.number, episode.series)} · {formatDate(episode.releaseDate)}
          </p>
          <p className="font-medium">{episode.title}</p>
          {change !== undefined && <Change value={change} />}
        </div>
        <ForkScore value={episode.averageForks} />
      </div>
      {episode.ratings.length > 0 && (
        <ul aria-label="Scores" className="mt-2 flex flex-wrap gap-1.5">
          {episode.ratings.map((rating) => (
            <li
              key={rating.person}
              className={cn(
                'bg-muted rounded-full px-2 py-0.5 text-xs',
                rating.forks === null && 'text-muted-foreground',
              )}
            >
              {rating.person.split(' ')[0]}{' '}
              <span className="font-semibold tabular-nums">
                {rating.forks ?? (rating.raw || '–')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
