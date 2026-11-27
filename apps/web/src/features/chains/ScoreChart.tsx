import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Episode } from '@doughboys-app/shared';
import { episodeLabel, formatDate } from '@/lib/format';

interface Point {
  date: string;
  forks: number;
  title: string;
  label: string;
}

/**
 * A chain's score at each rated visit, oldest to newest. One series, so no legend: the
 * heading names it. Thin line, 8px markers, a tooltip per visit, and a recessive grid.
 * The visit list below the chart is its table view.
 */
export function ScoreChart({ episodes }: { episodes: Episode[] }) {
  const points: Point[] = episodes
    .filter((e) => e.averageForks !== undefined)
    .map((e) => ({
      date: e.releaseDate ?? '',
      forks: e.averageForks!,
      title: e.title,
      label: episodeLabel(e.number, e.series),
    }));
  const scores = points.map((p) => p.forks);
  const top = Math.max(5, Math.ceil(Math.max(...scores)));
  // Start a step below the lowest score, not at 0, so a 4 vs a 5 is visible.
  const bottom = Math.max(0, Math.floor(Math.min(...scores)) - 1);

  return (
    <figure className="bg-card rounded-xl border p-3 pb-1">
      <figcaption className="text-muted-foreground mb-1 text-sm font-medium">
        Score over time
      </figcaption>
      <div className="h-44" role="img" aria-label={`Scores for ${points.length} rated visits`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) => date.slice(0, 4)}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={[bottom, top]}
              ticks={Array.from({ length: top - bottom + 1 }, (_, i) => bottom + i)}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-border)' }}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
                if (!point) return null;
                return (
                  <div className="bg-popover text-popover-foreground max-w-56 rounded-lg border px-3 py-2 text-xs shadow-md">
                    <div className="font-medium">{point.title}</div>
                    <div className="text-muted-foreground">
                      {point.label} · {formatDate(point.date)}
                    </div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">
                      {point.forks} forks
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="linear"
              dataKey="forks"
              stroke="var(--color-chart-score)"
              strokeWidth={2}
              dot={{
                r: 4,
                fill: 'var(--color-chart-score)',
                stroke: 'var(--color-card)',
                strokeWidth: 2,
              }}
              activeDot={{ r: 6, stroke: 'var(--color-card)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
