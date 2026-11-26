/**
 * Reads a fork rating as the wiki writes it: "4 forks", "3.5 forks", "1 fork", "4½ forks",
 * "4.25 forks (revised from 4)". Returns null when there's no number (e.g. "-", "N/A").
 * When several numbers appear, the first one is the rating given on the episode.
 */
export function parseForks(raw: string): number | null {
  const text = raw.replace(/\s*½/, '.5').replace(/\s*¼/, '.25').replace(/\s*¾/, '.75');
  const match = /(-?\d+(?:\.\d+)?)/.exec(text);
  if (!match) return null;
  const forks = Number(match[1]);
  return Number.isFinite(forks) ? forks : null;
}

/**
 * Mean of the ratings on the 0-5 scale, rounded to 2 places; undefined when there are none.
 * Joke scores outside the scale ("100 forks", "-1 forks") are left out.
 */
export function averageForks(ratings: { forks: number | null }[]): number | undefined {
  const numbers = ratings
    .map((r) => r.forks)
    .filter((f): f is number => f !== null && f >= 0 && f <= 5);
  if (numbers.length === 0) return undefined;
  const mean = numbers.reduce((sum, f) => sum + f, 0) / numbers.length;
  return Math.round(mean * 100) / 100;
}
