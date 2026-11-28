import type { ValidRating } from '@doughboys-app/shared';

/** A rating as stored: one per (chain, user). The display name is copied in for reads. */
export interface StoredRating extends Omit<ValidRating, 'review' | 'location'> {
  review?: string;
  location?: string;
  /** The chain's slug. */
  chain: string;
  /** Cognito `sub`: the stable, anonymous account ID. Never sent to other fans. */
  userId: string;
  displayName: string;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  /** Public review ID (random). Older ratings get one the first time they're read. */
  id?: string;
  /** How many different fans reported it. */
  reportCount?: number;
  /** Text hidden after REPORTS_TO_HIDE reports, until the owner restores it. */
  hidden?: boolean;
}

export interface RatingStore {
  /** Adds or replaces this user's rating for this chain. */
  put(rating: StoredRating): Promise<void>;
  get(chain: string, userId: string): Promise<StoredRating | undefined>;
  delete(chain: string, userId: string): Promise<void>;
  forChain(chain: string): Promise<StoredRating[]>;
  forUser(userId: string): Promise<StoredRating[]>;
  /** Every rating, for audience scores on the leaderboard. */
  all(): Promise<StoredRating[]>;
  /** Adds one to the rating's report count (atomically) and returns the new count. */
  addReport(chain: string, userId: string): Promise<number>;
  hide(chain: string, userId: string): Promise<void>;
}

/** A fan's report of a review. One per (review, reporter). */
export interface StoredReport {
  ratingId: string;
  /** The reporter's account ID. Never shown to anyone. */
  reporterId: string;
  chain: string;
  reason: string;
  note?: string;
  createdAt: string;
}

export interface ReportStore {
  /** Saves a report; false if this fan already reported this review. */
  add(report: StoredReport): Promise<boolean>;
  forReporter(reporterId: string): Promise<StoredReport[]>;
  delete(ratingId: string, reporterId: string): Promise<void>;
}

/** Tells the owner about a report (email via SNS in AWS). */
export interface ReportNotifier {
  notify(report: {
    chain: string;
    chainName: string;
    rating: StoredRating;
    reason: string;
    note?: string;
    reportCount: number;
    hidden: boolean;
  }): Promise<void>;
}

export interface StoredProfile {
  userId: string;
  displayName: string;
}

export interface ProfileStore {
  get(userId: string): Promise<StoredProfile | undefined>;
  put(profile: StoredProfile): Promise<void>;
  delete(userId: string): Promise<void>;
}

/** Deletes sign-in accounts. Cognito in AWS. */
export interface AccountDirectory {
  deleteAccount(userId: string): Promise<void>;
}
