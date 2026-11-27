import { AUDIENCE_MIN_RATINGS, type AudienceScore } from '@doughboys-app/shared';
import { ForkMeter } from '@/components/ForkMeter';

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** The Doughboys' score next to the fans' score, Rotten Tomatoes style. */
export function ScoreCompare({ critic, audience }: { critic?: number; audience?: AudienceScore }) {
  const count = audience?.count ?? 0;
  return (
    <div className="grid grid-cols-2 gap-2" aria-label="Scores" role="group">
      <div className="bg-card rounded-xl border p-3">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          The Doughboys
        </div>
        {critic !== undefined ? (
          <>
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {critic} <span className="text-muted-foreground text-sm font-normal">forks</span>
            </div>
            <ForkMeter value={critic} />
          </>
        ) : (
          <div className="text-muted-foreground text-sm">Not rated</div>
        )}
      </div>
      <div className="bg-card rounded-xl border p-3">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Fans
        </div>
        {audience?.average != null ? (
          <>
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {audience.average}{' '}
              <span className="text-muted-foreground text-sm font-normal">forks</span>
            </div>
            <ForkMeter value={audience.average} />
            <div className="text-muted-foreground mt-1 text-xs">{plural(count, 'rating')}</div>
          </>
        ) : (
          <div className="text-muted-foreground text-sm">
            {count === 0
              ? 'No ratings yet'
              : `${plural(count, 'rating')} so far; shows at ${AUDIENCE_MIN_RATINGS}`}
          </div>
        )}
      </div>
    </div>
  );
}
