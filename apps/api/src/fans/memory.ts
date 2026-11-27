import type {
  AccountDirectory,
  ProfileStore,
  RatingStore,
  StoredProfile,
  StoredRating,
} from './types.js';

export class InMemoryRatingStore implements RatingStore {
  private readonly ratings = new Map<string, StoredRating>();
  private key = (chain: string, userId: string) => `${chain}\u0000${userId}`;

  async put(rating: StoredRating) {
    this.ratings.set(this.key(rating.chain, rating.userId), structuredClone(rating));
  }
  async get(chain: string, userId: string) {
    return this.ratings.get(this.key(chain, userId));
  }
  async delete(chain: string, userId: string) {
    this.ratings.delete(this.key(chain, userId));
  }
  async forChain(chain: string) {
    return [...this.ratings.values()].filter((r) => r.chain === chain);
  }
  async forUser(userId: string) {
    return [...this.ratings.values()].filter((r) => r.userId === userId);
  }
  async all() {
    return [...this.ratings.values()];
  }
}

export class InMemoryProfileStore implements ProfileStore {
  private readonly profiles = new Map<string, StoredProfile>();
  async get(userId: string) {
    return this.profiles.get(userId);
  }
  async put(profile: StoredProfile) {
    this.profiles.set(profile.userId, { ...profile });
  }
  async delete(userId: string) {
    this.profiles.delete(userId);
  }
}

/** Local development and tests: remembers which accounts were deleted. */
export class FakeAccountDirectory implements AccountDirectory {
  readonly deleted: string[] = [];
  async deleteAccount(userId: string) {
    this.deleted.push(userId);
  }
}
