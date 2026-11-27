import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InMemoryChainStore } from '../chains/memory.js';
import type { ChainClassifier } from '../chains/types.js';
import { InMemoryEpisodeStore } from '../stores/memory.js';
import type { WikiPage, WikiSource } from './client.js';
import { importFromWiki } from './import.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

class FakeWiki implements WikiSource {
  constructor(private readonly pages: WikiPage[]) {}
  async *episodePages() {
    yield* this.pages.filter((p) => p.title !== 'Restaurants');
  }
  async page(title: string) {
    return this.pages.find((p) => p.title === title);
  }
}

describe('importFromWiki', () => {
  it('saves parsed episodes with their restaurant and reports what it did', async () => {
    const store = new InMemoryEpisodeStore();
    const result = await importFromWiki(
      new FakeWiki([
        { title: 'Restaurants', wikitext: fixture('restaurants.wiki') },
        {
          title: "Al's Beef with Megan Batoon & Amir Blumenfeld (LIVE)",
          wikitext: fixture('als-beef.wiki'),
        },
        { title: 'IHOP with Alison Agosti', wikitext: fixture('ihop.wiki') },
        { title: 'Not an episode', wikitext: 'Just text' },
      ]),
      store,
    );

    expect(result).toEqual({
      episodes: 2,
      withRatings: 2,
      withRestaurant: 1,
      skipped: ['Not an episode'],
      classified: 0,
    });
    expect(
      await store.getEpisode("Al's Beef with Megan Batoon & Amir Blumenfeld (LIVE)"),
    ).toMatchObject({
      restaurant: "Al's Beef",
      averageForks: 2.1, // the wiki's own figure
      number: '208',
    });
  });

  it('classifies only chains it has not seen before, and survives a classifier failure', async () => {
    const wiki = new FakeWiki([
      { title: 'Restaurants', wikitext: fixture('restaurants.wiki') },
      {
        title: "Al's Beef with Megan Batoon & Amir Blumenfeld (LIVE)",
        wikitext: fixture('als-beef.wiki'),
      },
      { title: 'Alamo Drafthouse with Drew McWeeny', wikitext: '{{InfoboxEp|ep_number=464}}' },
    ]);
    const chainStore = new InMemoryChainStore([
      { name: "Al's Beef", category: 'restaurant', domain: 'alsbeef.com' },
    ]);
    const asked: string[] = [];
    const classifier: ChainClassifier = {
      classify: async (chains) => {
        asked.push(...chains.map((c) => c.name));
        return chains.map((c) => ({ name: c.name, category: 'restaurant', domain: null }));
      },
    };

    const result = await importFromWiki(wiki, new InMemoryEpisodeStore(), {
      store: chainStore,
      classifier,
    });

    expect(asked).toEqual(['Alamo Drafthouse']);
    expect(result.classified).toBe(1);
    expect(await chainStore.all()).toHaveLength(2);

    const failing: ChainClassifier = {
      classify: async () => Promise.reject(new Error('API down')),
    };
    const again = await importFromWiki(wiki, new InMemoryEpisodeStore(), {
      store: new InMemoryChainStore(),
      classifier: failing,
    });
    expect(again).toMatchObject({
      episodes: 2,
      classified: 0,
      classificationError: 'Error: API down',
    });
  });
});
