import { cn } from '@/lib/utils';

/** A score like "3.83 forks", with the number emphasized. */
export function ForkScore({
  value,
  unit = 'forks',
  className,
}: {
  value: number | null | undefined;
  unit?: 'forks' | 'spoons';
  className?: string;
}) {
  if (value === null || value === undefined) {
    return <span className={cn('text-muted-foreground text-sm', className)}>Not rated</span>;
  }
  const label = value === 1 ? unit.slice(0, -1) : unit;
  return (
    <span className={cn('whitespace-nowrap', className)}>
      <span className="font-heading text-lg font-semibold tabular-nums">
        {Number.isInteger(value) ? value : value.toFixed(2).replace(/0$/, '')}
      </span>{' '}
      <span className="text-muted-foreground text-sm">{label}</span>
    </span>
  );
}
