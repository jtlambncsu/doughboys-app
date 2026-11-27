import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { MapPin } from 'lucide-react';
import type { FanRating } from '@doughboys-app/shared';
import { chainRatingsQueryOptions, meQueryOptions, myRatingsQueryOptions } from '@/api/queries';
import { useFan } from '@/auth/fan';
import { ForkScore } from '@/components/ForkScore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { DisplayNameForm } from './DisplayNameForm';
import { RatingForm } from './RatingForm';

function Review({ rating }: { rating: FanRating }) {
  return (
    <article className="bg-card space-y-2 rounded-xl border p-3">
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{rating.displayName}</div>
          <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
            <span>{formatDate(rating.updatedAt.slice(0, 10))}</span>
            {rating.location && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-3" aria-hidden /> {rating.location}
              </span>
            )}
          </div>
        </div>
        <ForkScore value={rating.forks} />
      </header>
      {rating.review && <p className="text-sm whitespace-pre-line">{rating.review}</p>}
    </article>
  );
}

/** The "rate it" area: sign in, pick a name, then the form. */
function RateIt({ slug, chainName }: { slug: string; chainName: string }) {
  const { api } = useRouteContext({ from: '__root__' });
  const fan = useFan();
  const signedIn = fan.status === 'signedIn';
  const [editing, setEditing] = useState(false);
  const me = useQuery({ ...meQueryOptions(api), enabled: signedIn });
  const mine = useQuery({ ...myRatingsQueryOptions(api), enabled: signedIn });
  const existing = mine.data?.find((r) => r.chain === slug);

  if (fan.status === 'loading') return null;
  if (!signedIn) {
    return (
      <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <p className="text-sm">Been to {chainName}? Add your own fork rating.</p>
        <Button onClick={fan.signIn}>Sign in to rate</Button>
      </div>
    );
  }
  if (me.isPending || mine.isPending) return <Skeleton className="h-16 w-full" />;
  if (!me.data?.displayName) {
    return (
      <div className="bg-card rounded-xl border p-4">
        <DisplayNameForm intro="Pick the name shown next to your reviews. You can change it later." />
      </div>
    );
  }
  if (editing) {
    return (
      <RatingForm
        slug={slug}
        chainName={chainName}
        existing={existing}
        onDone={() => setEditing(false)}
      />
    );
  }
  return (
    <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <p className="text-sm">
        {existing ? (
          <>
            You gave it <strong>{existing.forks} forks</strong>.
          </>
        ) : (
          `Been to ${chainName}? Add your fork rating.`
        )}
      </p>
      <Button onClick={() => setEditing(true)}>{existing ? 'Edit your rating' : 'Rate it'}</Button>
    </div>
  );
}

/** Fans' ratings for a chain: the rate-it box and everyone's reviews. */
export function FanRatings({ slug, chainName }: { slug: string; chainName: string }) {
  const { api } = useRouteContext({ from: '__root__' });
  const ratings = useQuery(chainRatingsQueryOptions(api, slug));

  return (
    <section aria-labelledby="fan-ratings" className="space-y-3">
      <h2 id="fan-ratings" className="font-heading text-lg font-semibold">
        Fan ratings
      </h2>
      <RateIt slug={slug} chainName={chainName} />
      {ratings.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : ratings.data && ratings.data.ratings.length > 0 ? (
        <ol aria-label="Fan reviews" className="space-y-2">
          {ratings.data.ratings.map((rating, i) => (
            <li key={`${rating.displayName}-${i}`}>
              <Review rating={rating} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">No fan ratings yet. Be the first!</p>
      )}
    </section>
  );
}
