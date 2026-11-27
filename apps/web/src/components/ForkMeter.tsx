import { cn } from '@/lib/utils';

/**
 * A small bar showing a score out of 5. Wiki averages can top 5 (bonus scores), which fill
 * the bar and turn it gold.
 */
export function ForkMeter({ value, className }: { value: number; className?: string }) {
  const bonus = value > 5;
  return (
    <span
      aria-hidden
      className={cn('bg-muted block h-1.5 w-full overflow-hidden rounded-full', className)}
    >
      <span
        className={cn('block h-full rounded-full', bonus ? 'bg-amber-400' : 'bg-primary')}
        style={{ width: `${Math.max(0, Math.min(value / 5, 1)) * 100}%` }}
      />
    </span>
  );
}
