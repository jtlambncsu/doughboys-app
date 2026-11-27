import { forksAndTines, tineLabel, TINES_PER_FORK } from '@doughboys-app/shared';
import { cn } from '@/lib/utils';

const TINE_X = [3, 8, 13, 18];

/**
 * One fork drawn with four tines. `filled` tines (0-4) are colored; the head and handle
 * fill in only when the whole fork counts, so "3 forks, 1 tine" reads at a glance.
 */
function Fork({ filled, size }: { filled: number; size: number }) {
  const whole = filled >= TINES_PER_FORK;
  const on = 'fill-primary';
  const off = 'fill-muted-foreground/20';
  return (
    <svg
      viewBox="0 0 24 44"
      width={(size * 24) / 44}
      height={size}
      aria-hidden
      className="shrink-0"
    >
      {TINE_X.map((x, i) => (
        <rect
          key={x}
          x={x}
          y={1}
          width={3}
          height={16}
          rx={1.5}
          className={i < filled ? on : off}
        />
      ))}
      <path d="M3 15h18v4a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z" className={whole ? on : off} />
      <rect x={10} y={23} width={4} height={20} rx={2} className={whole ? on : off} />
    </svg>
  );
}

/**
 * A score as five forks, filled tine by tine (a tine is a quarter fork). Scores above 5
 * (the wiki's bonus scores) show five full forks.
 */
export function ForkTines({
  value,
  size = 20,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const { forks, tines } = forksAndTines(Math.min(Math.max(value, 0), 5));
  return (
    <span
      role="img"
      aria-label={tineLabel(value)}
      className={cn('inline-flex items-end gap-0.5', className)}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Fork key={i} size={size} filled={i < forks ? TINES_PER_FORK : i === forks ? tines : 0} />
      ))}
    </span>
  );
}
