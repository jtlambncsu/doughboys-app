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
/** A quote, with who said it (or the context the wiki gives). */
export const quoteSchema = z.object({ text: z.string(), author: z.string().optional() });
export type Quote = z.infer<typeof quoteSchema>;

/** The rest of an episode's wiki page. Only on full episodes, not in lists. */
export const episodeDetailsSchema = z.object({
  synopsis: z.string().optional(),
  /** Nick's researched history of the chain that opens most episodes. */
  intro: z.string().optional(),
  quotes: z.array(quoteSchema),
  /** "Roast Spoonman": listeners' roasts of Mitch, the self-appointed Spoonman. */
  roasts: z.array(quoteSchema),
  /** What they tried in the Snack or Wack segment. */
  snackOrWack: z.string().optional(),
  /** Slugs of related episodes that exist in our data. */
  related: z.array(z.string()),
});
export type EpisodeDetails = z.infer<typeof episodeDetailsSchema>;

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
  details: episodeDetailsSchema.optional(),
});
export type Episode = z.infer<typeof episodeSchema>;

/** A list item: no per-person orders or page details, to keep the list response small. */
export type EpisodeSummary = Omit<Episode, 'ratings' | 'details'>;

/** One row of the leaderboard. */
/** What kind of place a "restaurant" from the wiki is. Some reviews aren't of restaurants. */
export const chainCategorySchema = z.enum([
  'restaurant',
  'grocery',
  'packaged_food',
  'produce',
  'drink',
  'other',
]);
export type ChainCategory = z.infer<typeof chainCategorySchema>;

/** What we know about a chain beyond the wiki: its kind and its website (for the logo). */
export const chainInfoSchema = z.object({
  name: z.string(),
  category: chainCategorySchema,
  /** The chain's main website, like "tacobell.com", or null when there isn't a clear one. */
  domain: z.string().nullable(),
});
export type ChainInfo = z.infer<typeof chainInfoSchema>;

export const chainSchema = z.object({
  /** URL-safe id, shared by spelling variants of the same name (see `chainSlug`). */
  slug: z.string(),
  name: z.string(),
  averageForks: z.number(),
  /** Every episode that reviewed it, rated or not. */
  visits: z.number(),
  /** The episodes whose scores make up `averageForks`. */
  ratedVisits: z.number(),
  latestEpisode: z.string(),
  /** Unknown until it has been classified. */
  category: chainCategorySchema.optional(),
  domain: z.string().optional(),
});
export type Chain = z.infer<typeof chainSchema>;

/** A chain's page: its summary plus every episode that featured it, oldest first. */
export const chainDetailSchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: chainCategorySchema.optional(),
  domain: z.string().optional(),
  /** Missing when no visit has a score. */
  averageForks: z.number().optional(),
  visits: z.number(),
  ratedVisits: z.number(),
  episodes: z.array(episodeSchema),
});
export type ChainDetail = z.infer<typeof chainDetailSchema>;

export function seriesFor(number: string | undefined): Series {
  if (number && /^\d+$/.test(number)) return 'main';
  if (number?.toUpperCase() === 'DD') return 'double';
  return 'other';
}
