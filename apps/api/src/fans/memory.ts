import type {
  AccountDirectory,
  ProfileStore,
  RatingStore,
  ReportNotifier,
  ReportStore,
  StoredProfile,
  StoredRating,
  StoredReport,
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
  async addReport(chain: string, userId: string) {
    const rating = this.ratings.get(this.key(chain, userId));
    if (!rating) return 0;
    rating.reportCount = (rating.reportCount ?? 0) + 1;
    return rating.reportCount;
  }
  async hide(chain: string, userId: string) {
    const rating = this.ratings.get(this.key(chain, userId));
    if (rating) rating.hidden = true;
  }
}

export class InMemoryReportStore implements ReportStore {
  readonly reports = new Map<string, StoredReport>();
  private key = (ratingId: string, reporterId: string) => `${ratingId}\u0000${reporterId}`;
  async add(report: StoredReport) {
    const key = this.key(report.ratingId, report.reporterId);
    if (this.reports.has(key)) return false;
    this.reports.set(key, { ...report });
    return true;
  }
  async forReporter(reporterId: string) {
    return [...this.reports.values()].filter((r) => r.reporterId === reporterId);
  }
  async delete(ratingId: string, reporterId: string) {
    this.reports.delete(this.key(ratingId, reporterId));
  }
}

/** Local development and tests: remembers what it would have emailed. */
export class FakeReportNotifier implements ReportNotifier {
  readonly sent: Parameters<ReportNotifier['notify']>[0][] = [];
  async notify(report: Parameters<ReportNotifier['notify']>[0]) {
    this.sent.push(report);
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
