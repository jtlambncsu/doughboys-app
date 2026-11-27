import { Minus, Plus } from 'lucide-react';
import { TINE, tineLabel } from '@doughboys-app/shared';
import { ForkTines } from '@/components/ForkTines';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

const MAX = 5;

/**
 * Pick a score the way the boys say it: forks and tines. Slide for speed, tap ± for one
 * tine at a time, or tap a fork to jump to that many whole forks.
 */
export function TinePicker({
  value,
  onChange,
  labelId,
}: {
  value: number;
  onChange: (value: number) => void;
  labelId: string;
}) {
  const set = (next: number) =>
    onChange(Math.min(MAX, Math.max(0, Math.round(next / TINE) * TINE)));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="relative">
          <ForkTines value={value} size={40} />
          {/* Invisible buttons over each fork: tap the third fork for 3 forks. */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: MAX }, (_, i) => (
              <button
                key={i}
                type="button"
                className="h-full flex-1"
                aria-label={`${i + 1} fork${i === 0 ? '' : 's'}`}
                onClick={() => set(i + 1)}
              />
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="font-heading text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-muted-foreground text-xs" aria-live="polite">
            {tineLabel(value)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="One tine less"
          disabled={value <= 0}
          onClick={() => set(value - TINE)}
        >
          <Minus className="size-4" aria-hidden />
        </Button>
        <Slider
          aria-labelledby={labelId}
          aria-valuetext={tineLabel(value)}
          min={0}
          max={MAX}
          step={TINE}
          value={[value]}
          onValueChange={([next]) => set(next ?? value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="One tine more"
          disabled={value >= MAX}
          onClick={() => set(value + TINE)}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
