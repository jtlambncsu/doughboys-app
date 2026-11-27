import { z } from 'zod';

/** A chain shows its audience score only once this many fans have rated it. */
export const AUDIENCE_MIN_RATINGS = 3;

/** Empty strings from a form mean "not given". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .transform((value) => value || undefined);

/**
 * The name shown next to a fan's reviews. Letters (any language), numbers, spaces and a
 * little punctuation: enough for real names and handles, no links or markup.
 */
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'At least 2 characters')
  .max(30, 'Up to 30 characters')
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._'’-]*$/u, "Letters, numbers, spaces and . _ ' - only");

export const profileInputSchema = z.object({ displayName: displayNameSchema });
export type ProfileInput = z.infer<typeof profileInputSchema>;

export interface Profile {
  displayName?: string;
}

/** What a fan sends to rate a chain. */
export const ratingInputSchema = z.object({
  forks: z
    .number()
    .min(0, 'From 0 forks')
    .max(5, 'Up to 5 forks')
    .multipleOf(0.5, 'Half forks at most'),
  review: optionalText(500),
  location: optionalText(80),
});
export type RatingInput = z.input<typeof ratingInputSchema>;
export type ValidRating = z.output<typeof ratingInputSchema>;

/** A fan's rating as anyone can see it. No account ID: just the chosen display name. */
export interface FanRating {
  displayName: string;
  forks: number;
  review?: string;
  location?: string;
  /** ISO timestamp. */
  updatedAt: string;
}

/** One of your own ratings, with the chain it's for. */
export interface MyRating extends FanRating {
  chain: string;
  chainName?: string;
}

export interface AudienceScore {
  /** Mean of fans' forks, or null until AUDIENCE_MIN_RATINGS fans have rated. */
  average: number | null;
  count: number;
}

export interface ChainRatings {
  audience: AudienceScore;
  /** Newest first. */
  ratings: FanRating[];
}

export function audienceScore(forks: number[]): AudienceScore {
  if (forks.length < AUDIENCE_MIN_RATINGS) return { average: null, count: forks.length };
  const mean = forks.reduce((sum, f) => sum + f, 0) / forks.length;
  return { average: Math.round(mean * 100) / 100, count: forks.length };
}
