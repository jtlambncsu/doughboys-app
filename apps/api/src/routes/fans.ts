import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import {
  audienceScore,
  displayName as chainDisplayName,
  profileInputSchema,
  ratingInputSchema,
  REPORTS_TO_HIDE,
  reportInputSchema,
  type ChainRatings,
  type FanRating,
  type MyRating,
  type Profile,
} from '@doughboys-app/shared';
import type { z } from 'zod';
import type { Catalog } from '../catalog.js';
import { requireUser, type ResolveUser } from '../auth.js';
import type {
  AccountDirectory,
  ProfileStore,
  RatingStore,
  ReportNotifier,
  ReportStore,
  StoredRating,
} from '../fans/types.js';

export interface FansDeps {
  catalog: Catalog;
  ratings: RatingStore;
  profiles: ProfileStore;
  accounts: AccountDirectory;
  reports: ReportStore;
  notifier: ReportNotifier;
  resolveUser: ResolveUser;
  clock: () => Date;
}

type WithId = StoredRating & { id: string };

/** What other fans may see: no account ID, and no text once a review is hidden. */
function publicRating({
  id,
  displayName,
  forks,
  review,
  location,
  updatedAt,
  hidden,
}: WithId): FanRating {
  if (hidden) return { id, displayName, forks, updatedAt, hidden: true };
  return {
    id,
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
  const { catalog, ratings, profiles, accounts, reports, notifier, clock } = deps;
  const router = Router();
  const signedIn = requireUser(deps.resolveUser);

  /** Ratings saved before public IDs existed get one, once. */
  async function withIds(list: StoredRating[]): Promise<WithId[]> {
    const out: WithId[] = [];
    for (const rating of list) {
      if (rating.id) {
        out.push(rating as WithId);
      } else {
        const updated = { ...rating, id: randomUUID() };
        await ratings.put(updated);
        out.push(updated);
      }
    }
    return out;
  }

  // --- Public ---

  router.get('/chains/:slug/ratings', async (req, res) => {
    if (!(await catalog.visits(req.params.slug))) {
      res.status(404).json({ error: 'Chain not found' });
      return;
    }
    const all = await withIds(await ratings.forChain(req.params.slug));
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
    const mine = await withIds(await ratings.forUser(res.locals.userId));
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
    const rating: WithId = {
      ...parsed.data,
      chain: slug,
      userId,
      displayName: profile.displayName,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      id: existing?.id ?? randomUUID(),
      // Reports stick: editing a hidden review doesn't un-hide it.
      ...(existing?.reportCount && { reportCount: existing.reportCount }),
      ...(existing?.hidden && { hidden: true }),
    };
    await ratings.put(rating);
    catalog.audience.clear();
    res.json(publicRating(rating));
  });

  // Report another fan's review (ADR 0014). One report per fan per review; enough reports
  // hide the review's text until the owner moderates it.
  router.post('/chains/:slug/ratings/:id/report', signedIn, async (req, res) => {
    const slug = String(req.params.slug);
    const ratingId = String(req.params.id);
    const parsed = reportInputSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const reporterId: string = res.locals.userId;
    const rating = (await withIds(await ratings.forChain(slug))).find((r) => r.id === ratingId);
    if (!rating) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    if (rating.userId === reporterId) {
      res.status(400).json({ error: 'You can’t report your own review' });
      return;
    }
    const added = await reports.add({
      ratingId,
      reporterId,
      chain: slug,
      reason: parsed.data.reason,
      ...(parsed.data.note && { note: parsed.data.note }),
      createdAt: clock().toISOString(),
    });
    if (!added) {
      res.status(409).json({ error: 'You’ve already reported this review' });
      return;
    }
    const reportCount = await ratings.addReport(slug, rating.userId);
    const hidden = Boolean(rating.hidden) || reportCount >= REPORTS_TO_HIDE;
    if (hidden && !rating.hidden) await ratings.hide(slug, rating.userId);

    // Email the owner. A failed email mustn't lose the report, so it's only logged.
    const visits = await catalog.visits(slug);
    await notifier
      .notify({
        chain: slug,
        chainName: visits ? chainDisplayName(visits) : slug,
        rating,
        reason: parsed.data.reason,
        note: parsed.data.note,
        reportCount,
        hidden,
      })
      .catch((error) => console.error('Report email failed', error));

    res.status(201).json({ hidden });
  });

  router.delete('/chains/:slug/rating', signedIn, async (req, res) => {
    await ratings.delete(String(req.params.slug), res.locals.userId);
    catalog.audience.clear();
    res.status(204).end();
  });

  // Deletes everything we hold about the caller: ratings, reports they made, profile, then
  // the sign-in account.
  router.delete('/me', signedIn, async (_req, res) => {
    const userId: string = res.locals.userId;
    for (const rating of await ratings.forUser(userId)) {
      await ratings.delete(rating.chain, userId);
    }
    for (const report of await reports.forReporter(userId)) {
      await reports.delete(report.ratingId, userId);
    }
    await profiles.delete(userId);
    await accounts.deleteAccount(userId);
    catalog.audience.clear();
    res.status(204).end();
  });

  return router;
}
