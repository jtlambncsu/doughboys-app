import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { descriptionText, episodeFromFeed, parseFeed } from './feed.js';

const xml = readFileSync(new URL('./fixtures/doughboys-feed.xml', import.meta.url), 'utf8');

describe('parseFeed', () => {
  const episodes = parseFeed(xml);

  it('reads numbered episodes and skips bonus ones', () => {
    expect(episodes.map((e) => [e.number, e.title, e.releaseDate])).toEqual([
      ['570', 'TMNT Pizzeria with Podcast: The Ride', '2026-11-19'],
      ['569', 'Chipotle 4 with Raina Huang', '2026-11-12'],
      ['568', 'Skywalker Grill with Connor Ratliff and Griffin Newman', '2026-11-05'],
    ]);
  });

  it('keeps the synopsis without the promo links, and finds what was reviewed', () => {
    const chipotle = episodes[1]!;
    expect(chipotle.synopsis).toBe(
      "Raina Huang (@rainaiscrazy) joins the 'boys to talk competitive eating, spice challenges, and favorite flavor profiles before a review of Chipotle. Plus, another edition of Snack or Wack.",
    );
    expect(chipotle.reviewOf).toBe('Chipotle');
    expect(episodes[0]!.reviewOf).toBe('TMNT Pizza');
  });
});

describe('descriptionText', () => {
  it('turns paragraphs into blank-line breaks and decodes entities', () => {
    expect(
      descriptionText('<p>Tom &amp; Jerry</p><p>Second</p><p>Watch this episode at x</p>'),
    ).toBe('Tom & Jerry\n\nSecond');
  });
});

describe('episodeFromFeed', () => {
  it('uses the known spelling of a chain, or the name as written', () => {
    const known = new Map([['chipotle', 'Chipotle']]);
    const [tmnt, chipotle] = parseFeed(xml);
    expect(episodeFromFeed(chipotle!, known)).toMatchObject({
      slug: 'Chipotle 4 with Raina Huang',
      series: 'main',
      number: '569',
      restaurant: 'Chipotle',
      source: 'feed',
      ratings: [],
    });
    expect(episodeFromFeed(tmnt!, known).restaurant).toBe('TMNT Pizza');
    expect(episodeFromFeed(chipotle!, known)).not.toHaveProperty('wikiUrl');
  });
});
