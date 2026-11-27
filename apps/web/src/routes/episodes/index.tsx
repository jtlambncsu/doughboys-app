import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { episodesQueryOptions } from '@/api/queries';
import { ForkScore } from '@/components/ForkScore';
import { ListSkeleton } from '@/components/ListSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { episodeLabel, formatDate } from '@/lib/format';
import { matches } from '@/lib/search';

const seriesFilter = z.enum(['all', 'main', 'double', 'other']);
const PAGE = 100;

export const Route = createFileRoute('/episodes/')({
  validateSearch: z.object({
    q: z.string().optional(),
    series: seriesFilter.optional(),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(episodesQueryOptions(context.api)),
  pendingComponent: ListSkeleton,
  component: Episodes,
});

function Episodes() {
  const { api } = Route.useRouteContext();
  const { q = '', series = 'main' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: episodes } = useSuspenseQuery(episodesQueryOptions(api));
  const [limit, setLimit] = useState(PAGE);

  const shown = episodes.filter(
    (e) =>
      (series === 'all' || e.series === series) &&
      matches(q, e.title, e.restaurant, e.number, ...e.guests),
  );

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-2xl font-semibold">Episodes</h1>
      <Input
        type="search"
        aria-label="Search episodes"
        placeholder="Search by chain, guest or number"
        value={q}
        onChange={(e) =>
          void navigate({
            search: (prev) => ({ ...prev, q: e.target.value || undefined }),
            replace: true,
          })
        }
      />
      <Tabs
        value={series}
        onValueChange={(value) =>
          void navigate({
            search: (prev) => ({ ...prev, series: seriesFilter.parse(value) }),
            replace: true,
          })
        }
      >
        <TabsList>
          <TabsTrigger value="main">Main show</TabsTrigger>
          <TabsTrigger value="double">Double</TabsTrigger>
          <TabsTrigger value="other">Specials</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {shown.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No episodes match.</p>
      ) : (
        <>
          <ul className="divide-y rounded-lg border" aria-label="Episodes">
            {shown.slice(0, limit).map((episode) => (
              <li key={episode.slug}>
                <Link
                  to="/episodes/$slug"
                  params={{ slug: episode.slug }}
                  className="hover:bg-accent flex items-center gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{episode.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {[
                        episodeLabel(episode.number, episode.series),
                        formatDate(episode.releaseDate),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {episode.averageForks !== undefined && <ForkScore value={episode.averageForks} />}
                  {episode.source === 'feed' && <Badge>New</Badge>}
                </Link>
              </li>
            ))}
          </ul>
          {shown.length > limit && (
            <Button variant="outline" className="w-full" onClick={() => setLimit(limit + PAGE)}>
              Show more ({shown.length - limit} left)
            </Button>
          )}
        </>
      )}
    </section>
  );
}
