import { Router, type Response } from 'express';
import {
  audienceScore,
  displayName as chainDisplayName,
  profileInputSchema,
  ratingInputSchema,
  type ChainRatings,
  type FanRating,
  type MyRating,
  type Profile,
} from '@doughboys-app/shared';
import type { z } from 'zod';
import type { Catalog } from '../catalog.js';
import { requireUser, type ResolveUser } from '../auth.js';
import type { AccountDirectory, ProfileStore, RatingStore, StoredRating } from '../fans/types.js';

export interface FansDeps {
  catalog: Catalog;
  ratings: RatingStore;
  profiles: ProfileStore;
  accounts: AccountDirectory;
  resolveUser: ResolveUser;
  clock: () => Date;
}

/** What other fans may see: no account ID. */
function publicRating({
  displayName,
  forks,
  review,
  location,
  updatedAt,
}: StoredRating): FanRating {
  return {
    displayName,
    forks,
    ...(review && { review }),
    ...(location && { location }),
    updatedAt,
  };
}

const newestFirst = (a: { updatedAt: string }, b: { updatedAt: string }) =>
  b.updatedAt.localeCompare(a.updatedAt);

function badRequest(res: Response, error: z.ZodError) {
  res.status(400).json({
    error: 'Invalid input',
    issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}

/**
 * Fans' ratings (ADR 0010). Reading is public; anything about "me" needs a signed-in fan,
 * checked by API Gateway's JWT authorizer and again here. A fan can only ever read or
 * change their own profile and ratings: the user ID comes from the verified token, never
 * from the request body or URL.
 */
export function fansRouter(deps: FansDeps) {
  const { catalog, ratings, profiles, accounts, clock } = deps;
  const router = Router();
  const signedIn = requireUser(deps.resolveUser);

  // --- Public ---

  router.get('/chains/:slug/ratings', async (req, res) => {
    if (!(await catalog.visits(req.params.slug))) {
      res.status(404).json({ error: 'Chain not found' });
      return;
    }
    const all = await ratings.forChain(req.params.slug);
    const body: ChainRatings = {
      audience: audienceScore(all.map((r) => r.forks)),
      ratings: all.map(publicRating).sort(newestFirst),
    };
    res.json(body);
  });

  // --- Signed in: only ever the caller's own data ---

  router.get('/me', signedIn, async (_req, res) => {
    const profile = await profiles.get(res.locals.userId);
    const body: Profile = profile ? { displayName: profile.displayName } : {};
    res.json(body);
  });

  router.put('/me', signedIn, async (req, res) => {
    const parsed = profileInputSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const userId: string = res.locals.userId;
    await profiles.put({ userId, displayName: parsed.data.displayName });
    // Ratings carry the name for fast reads; keep them in step.
    for (const rating of await ratings.forUser(userId)) {
      await ratings.put({ ...rating, displayName: parsed.data.displayName });
    }
    res.json({ displayName: parsed.data.displayName } satisfies Profile);
  });

  router.get('/me/ratings', signedIn, async (_req, res) => {
    const mine = await ratings.forUser(res.locals.userId);
    const names = new Map<string, string>();
    const body: MyRating[] = [];
    for (const rating of mine.sort(newestFirst)) {
      if (!names.has(rating.chain)) {
        const visits = await catalog.visits(rating.chain);
        if (visits) names.set(rating.chain, chainDisplayName(visits));
      }
      body.push({
        ...publicRating(rating),
        chain: rating.chain,
        chainName: names.get(rating.chain),
      });
    }
    res.json(body);
  });

  router.put('/chains/:slug/rating', signedIn, async (req, res) => {
    const slug = String(req.params.slug);
    if (!(await catalog.visits(slug))) {
      res.status(404).json({ error: 'Chain not found' });
      return;
    }
    const parsed = ratingInputSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const userId: string = res.locals.userId;
    const profile = await profiles.get(userId);
    if (!profile) {
      res.status(409).json({ error: 'Choose a display name before rating' });
      return;
    }
    const now = clock().toISOString();
    const existing = await ratings.get(slug, userId);
    const rating: StoredRating = {
      ...parsed.data,
      chain: slug,
      userId,
      displayName: profile.displayName,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await ratings.put(rating);
    catalog.audience.clear();
    res.json(publicRating(rating));
  });

  router.delete('/chains/:slug/rating', signedIn, async (req, res) => {
    await ratings.delete(String(req.params.slug), res.locals.userId);
    catalog.audience.clear();
    res.status(204).end();
  });

  // Deletes everything we hold about the caller: ratings, profile, then the sign-in account.
  router.delete('/me', signedIn, async (_req, res) => {
    const userId: string = res.locals.userId;
    for (const rating of await ratings.forUser(userId)) {
      await ratings.delete(rating.chain, userId);
    }
    await profiles.delete(userId);
    await accounts.deleteAccount(userId);
    catalog.audience.clear();
    res.status(204).end();
  });

  return router;
}
