import type { Episode } from '@doughboys-app/shared';
import { newestFirst, toSummary, type EpisodeStore } from './types.js';

export class InMemoryEpisodeStore implements EpisodeStore {
  private readonly episodes = new Map<string, Episode>();

  constructor(initial: Episode[] = []) {
    for (const episode of initial) this.episodes.set(episode.slug, episode);
  }

  async putEpisodes(episodes: Episode[]) {
    for (const episode of episodes) this.episodes.set(episode.slug, episode);
  }

  async listEpisodes() {
    return [...this.episodes.values()].map(toSummary).sort(newestFirst);
  }

  async getEpisode(slug: string) {
    return this.episodes.get(slug);
  }

  all() {
    return [...this.episodes.values()];
  }
}
