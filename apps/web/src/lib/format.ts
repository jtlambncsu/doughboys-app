/** "2015-05-28" → "May 28, 2015", without time zone surprises. */
export function formatDate(iso: string | undefined) {
  if (!iso) return undefined;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function episodeLabel(number: string | undefined, series: string) {
  if (series === 'main' && number) return `#${number}`;
  if (series === 'double') return 'Double';
  return number ?? 'Special';
}
