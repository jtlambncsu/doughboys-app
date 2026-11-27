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
  ordered: z
    .array(z.string().trim().min(1).max(60, 'Keep each item under 60 characters'))
    .max(12, 'Up to 12 items')
    .default([]),
  review: optionalText(500),
  location: optionalText(80),
});
export type RatingInput = z.input<typeof ratingInputSchema>;
export type ValidRating = z.output<typeof ratingInputSchema>;

/** A fan's rating as anyone can see it. No account ID: just the chosen display name. */
export interface FanRating {
  displayName: string;
  forks: number;
  ordered: string[];
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

export interface MenuItem {
  name: string;
  /** How many times it was ordered, by the boys and by fans. */
  count: number;
}

export function audienceScore(forks: number[]): AudienceScore {
  if (forks.length < AUDIENCE_MIN_RATINGS) return { average: null, count: forks.length };
  const mean = forks.reduce((sum, f) => sum + f, 0) / forks.length;
  return { average: Math.round(mean * 100) / 100, count: forks.length };
}

/**
 * Merges order lists into a menu, most ordered first. Spelling and case differences
 * ("Crunchwrap Supreme", "crunchwrap supreme") count as one item, shown in the most common form.
 */
export function buildMenu(orders: string[][]): MenuItem[] {
  const byKey = new Map<string, { names: Map<string, number>; count: number }>();
  for (const items of orders) {
    for (const raw of new Set(items.map((i) => i.trim()).filter(Boolean))) {
      const key = raw
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
      if (!key) continue;
      const entry = byKey.get(key) ?? { names: new Map(), count: 0 };
      entry.count++;
      entry.names.set(raw, (entry.names.get(raw) ?? 0) + 1);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .map(({ names, count }) => ({
      name: [...names].reduce((a, b) => (b[1] > a[1] ? b : a))[0],
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
