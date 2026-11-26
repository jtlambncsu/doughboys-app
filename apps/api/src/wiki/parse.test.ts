import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEpisodePage, parseRestaurantsPage, toIsoDate } from './parse.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('parseEpisodePage', () => {
  it('reads the infobox and a plain ratings table', () => {
    const episode = parseEpisodePage('IHOP with Alison Agosti', fixture('ihop.wiki'));
    expect(episode).toMatchObject({
      slug: 'IHOP with Alison Agosti',
      number: '3',
      series: 'main',
      releaseDate: '2015-05-28',
      guests: ['Alison Agosti', 'Dave Ferguson'],
      averageForks: 3.83,
      wikiUrl: 'https://doughboys.fandom.com/wiki/IHOP_with_Alison_Agosti',
    });
    expect(episode?.ratings).toEqual([
      {
        person: 'Nick Wiger',
        forks: 4,
        unit: 'forks',
        raw: '4 forks',
        ordered: ['Coffee', 'Splashberry', 'Double Blueberry Pancakes'],
      },
      expect.objectContaining({ person: 'Mike Mitchell', forks: 3.5 }),
      expect.objectContaining({ person: 'Alison Agosti', forks: 4 }),
    ]);
  });

  it('finds ratings when a spanning cell shifts the columns, and skips the shared row', () => {
    const episode = parseEpisodePage(
      "Al's Beef with Megan Batoon & Amir Blumenfeld (LIVE)",
      fixture('als-beef.wiki'),
    );
    expect(episode?.title).toBe("Al's Beef with Megan Batoon and Amir Blumenfeld");
    expect(episode?.ratings.map((r) => [r.person, r.forks])).toEqual([
      ['Nick Wiger', 2.5],
      ['Mike Mitchell', 3.9],
      ['Megan Batoon', 1],
      ['Amir Blumenfeld', 1],
    ]);
    expect(episode?.ratings[0]?.ordered).toEqual([
      '1/3 Lb Burger',
      'Little Beef',
      'The Tamale Boat',
    ]);
  });

  it('reads spoon ratings, and forks out of a cell with several scores', () => {
    const table = (heading: string, cell: string) =>
      `{{InfoboxEp|ep_number=71}}\n== ${heading} ==\n{|\n!guest / host\n!ordered\n!rating\n|-\n|Nick Wiger\n|\n* Sundae\n|${cell}\n|}`;
    expect(
      parseEpisodePage('a', table('Little Pink Spoon rating', '3.5 spoons with a cherry on top'))
        ?.ratings[0],
    ).toMatchObject({ forks: 3.5, unit: 'spoons', ordered: ['Sundae'] });
    expect(
      parseEpisodePage(
        'b',
        table('Fork and Dinner Plate rating 🍽️', '\n* 4 forks\n* 3 dinner plates'),
      )?.ratings[0],
    ).toMatchObject({ forks: 4, unit: 'forks' });
  });

  it('ignores pages without an episode infobox', () => {
    expect(parseEpisodePage('Fork Rating', 'The fork rating is out of five.')).toBeUndefined();
  });

  it('labels Doughboys Double episodes', () => {
    const episode = parseEpisodePage(
      'RIP Mama Celeste',
      '{{InfoboxEp|ep_number=DD|release_date=November 10, 2026|guest=Sandy Honig}}',
    );
    expect(episode).toMatchObject({ series: 'double', ratings: [], guests: ['Sandy Honig'] });
    expect(episode?.averageForks).toBeUndefined();
  });
});

describe('parseRestaurantsPage', () => {
  it('maps episode pages to restaurants', () => {
    const map = parseRestaurantsPage(fixture('restaurants.wiki'));
    expect(map.get("Al's Beef with Megan Batoon & Amir Blumenfeld (LIVE)")).toEqual({
      restaurant: "Al's Beef",
      rating: 2.1,
    });
    expect(map.get('Alamo Drafthouse with Drew McWeeny')).toEqual({
      restaurant: 'Alamo Drafthouse',
      rating: 4,
    });
    expect(map.get('The Beer Store with Norm Sousa')).toEqual({ restaurant: 'A&W Canada' });
  });
});

describe('toIsoDate', () => {
  it('converts wiki dates and rejects junk', () => {
    expect(toIsoDate('February 27, 2020')).toBe('2020-02-27');
    expect(toIsoDate('TBA')).toBeUndefined();
  });
});
