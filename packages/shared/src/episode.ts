import { z } from 'zod';

/** One person's verdict at the end of an episode: what they ordered and their fork rating. */
export const ratingSchema = z.object({
  person: z.string(),
  /** Out of 5, or null when the wiki has no usable number (e.g. "-", "N/A"). */
  forks: z.number().nullable(),
  /** Ice cream episodes are rated in "Little Pink Spoons" instead of forks. */
  unit: z.enum(['forks', 'spoons']),
  /** The rating exactly as written on the wiki, e.g. "3.5 forks". */
  raw: z.string(),
  ordered: z.array(z.string()),
});
export type Rating = z.infer<typeof ratingSchema>;

/** Main show, the Doughboys Double premium feed, or anything else (specials, live shows). */
export const seriesSchema = z.enum(['main', 'double', 'other']);
export type Series = z.infer<typeof seriesSchema>;

export const episodeSchema = z.object({
  /** The wiki page title. Unique, stable and URL-safe once encoded, so it's the id. */
  slug: z.string(),
  title: z.string(),
  /** "3", "464", or a label like "DD" for Doughboys Double. */
  number: z.string().optional(),
  series: seriesSchema,
  /** ISO date, YYYY-MM-DD. */
  releaseDate: z.string().optional(),
  /** The chain or restaurant reviewed, from the wiki's Restaurants list. */
  restaurant: z.string().optional(),
  guests: z.array(z.string()),
  ratings: z.array(ratingSchema),
  /**
   * The episode's overall score: the wiki's figure from its Restaurants list when it has one
   * (fans there handle joke scores like "100 forks"), otherwise the mean of the 0-5 ratings.
   */
  averageForks: z.number().optional(),
  wikiUrl: z.url(),
});
export type Episode = z.infer<typeof episodeSchema>;

/** A list item: everything except the per-person orders, to keep the list response small. */
export type EpisodeSummary = Omit<Episode, 'ratings'>;

/** One row of the leaderboard. */
export const chainSchema = z.object({
  name: z.string(),
  averageForks: z.number(),
  episodeCount: z.number(),
  latestEpisode: z.string(),
});
export type Chain = z.infer<typeof chainSchema>;

export function seriesFor(number: string | undefined): Series {
  if (number && /^\d+$/.test(number)) return 'main';
  if (number?.toUpperCase() === 'DD') return 'double';
  return 'other';
}
