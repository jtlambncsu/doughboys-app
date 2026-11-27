import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { chainSlug } from '@doughboys-app/shared';
import { episodeQueryOptions } from '@/api/queries';
import { EpisodeExtras, Paragraphs } from '@/features/episodes/EpisodeDetails';
import { ForkScore } from '@/components/ForkScore';
import { ListSkeleton } from '@/components/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { episodeLabel, formatDate } from '@/lib/format';

export const Route = createFileRoute('/episodes/$slug')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(episodeQueryOptions(context.api, params.slug)),
  pendingComponent: ListSkeleton,
  component: EpisodePage,
});

function EpisodePage() {
  const { api } = Route.useRouteContext();
  const { slug } = Route.useParams();
  const { data: episode } = useSuspenseQuery(episodeQueryOptions(api, slug));

  return (
    <article className="space-y-5">
      <Link to="/episodes" className="text-muted-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> All episodes
      </Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{episodeLabel(episode.number, episode.series)}</Badge>
          {episode.source === 'feed' && <Badge>New</Badge>}
          {episode.releaseDate && (
            <span className="text-muted-foreground text-sm">{formatDate(episode.releaseDate)}</span>
          )}
        </div>
        <h1 className="font-heading text-2xl font-semibold">{episode.title}</h1>
        {episode.restaurant && (
          <Link
            to="/chains/$slug"
            params={{ slug: chainSlug(episode.restaurant) }}
            className="text-primary text-lg underline-offset-4 hover:underline"
          >
            {episode.restaurant}
          </Link>
        )}
        {episode.guests.length > 0 && (
          <p className="text-muted-foreground text-sm">With {episode.guests.join(', ')}</p>
        )}
        {episode.averageForks !== undefined && (
          <p>
            Overall: <ForkScore value={episode.averageForks} />
          </p>
        )}
      </header>

      {episode.details?.synopsis && (
        <Paragraphs text={episode.details.synopsis} className="leading-relaxed" />
      )}

      {episode.ratings.length > 0 ? (
        <section aria-label="Ratings" className="grid gap-3 sm:grid-cols-2">
          {episode.ratings.map((rating) => (
            <Card key={rating.person} className="gap-2 py-4">
              <CardHeader className="flex flex-row items-baseline justify-between gap-2 px-4">
                <CardTitle className="text-base">{rating.person}</CardTitle>
                {rating.forks === null ? (
                  <span className="text-muted-foreground text-sm">{rating.raw || 'No rating'}</span>
                ) : (
                  <ForkScore value={rating.forks} unit={rating.unit} />
                )}
              </CardHeader>
              {rating.ordered.length > 0 && (
                <CardContent className="px-4">
                  <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-sm">
                    {rating.ordered.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          ))}
        </section>
      ) : (
        <p className="text-muted-foreground">
          {episode.source === 'feed'
            ? 'Just released. Ratings, orders and quotes will appear once fans add this episode to the wiki, usually within a couple of weeks.'
            : 'The wiki has no ratings for this episode yet.'}
        </p>
      )}

      {episode.details && <EpisodeExtras details={episode.details} />}

      {episode.wikiUrl ? (
        <a
          href={episode.wikiUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary inline-flex items-center gap-1 text-sm underline"
        >
          Read more on the Doughboys Wikia <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : (
        <p className="text-muted-foreground text-xs">Synopsis from the official podcast feed.</p>
      )}
    </article>
  );
}
