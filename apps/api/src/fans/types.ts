import type { ValidRating } from '@doughboys-app/shared';

/** A rating as stored: one per (chain, user). The display name is copied in for reads. */
export interface StoredRating extends ValidRating {
  /** The chain's slug. */
  chain: string;
  /** Cognito `sub`: the stable, anonymous account ID. Never sent to other fans. */
  userId: string;
  displayName: string;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
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
