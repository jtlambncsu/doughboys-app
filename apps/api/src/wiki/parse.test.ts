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

  it('ignores list averages above 5 (they count joke scores)', () => {
    const wikitext =
      '{|\n!Restaurant\n!Rating\n!Release Date\n!Episode\n!notes\n|-\n|Zankou Chicken\n|5.67\n|Oct 12, 2023\n|[[Zankou Chicken with Jason Mantzoukas|419]]\n|\n|}';
    expect(parseRestaurantsPage(wikitext).get('Zankou Chicken with Jason Mantzoukas')).toEqual({
      restaurant: 'Zankou Chicken',
    });
  });

  it('normalizes non-breaking spaces in names', () => {
    const wikitext =
      '{|\n!Restaurant\n!Rating\n!Release Date\n!Episode\n!notes\n|-\n|Sweetfin\u00a0Poké\n|4.00\n|May 1, 2019\n|[[Sweetfin Poké with Someone|200]]\n|\n|}';
    expect(parseRestaurantsPage(wikitext).get('Sweetfin Poké with Someone')).toEqual({
      restaurant: 'Sweetfin Poké',
      rating: 4,
    });
  });
});

describe('toIsoDate', () => {
  it('converts wiki dates and rejects junk', () => {
    expect(toIsoDate('February 27, 2020')).toBe('2020-02-27');
    expect(toIsoDate('TBA')).toBeUndefined();
  });
});

describe('parseDetails', () => {
  const episode = parseEpisodePage(
    'Alamo Drafthouse with Drew McWeeny',
    fixture('alamo-drafthouse.wiki'),
  )!;
  const details = episode.details!;

  it('reads the synopsis and Nick’s intro as paragraphs', () => {
    expect(details.synopsis).toMatch(/^Drew McWeeny .* joins the 'boys/);
    expect(details.intro).toMatch(/^In 1946, amidst the American occupation/);
    expect(details.intro).toContain('\n\n');
  });

  it('reads quotes and roasts with their authors', () => {
    expect(details.quotes[0]).toEqual({
      text: 'As a projectionist, was there ever a time when the Gremlins tried to take over the projection?',
      author: 'Mike Mitchell re: Drew working in a movie theater',
    });
    expect(details.quotes.length).toBeGreaterThan(1);
    expect(details.roasts).toEqual([
      { text: "A Man Who CC's Pizza On Every E-mail", author: 'Jeffrey' },
    ]);
  });

  it('describes the Snack or Wack without the segment’s boilerplate', () => {
    expect(details.snackOrWack).toMatch(/^For this episode, they try the "Tom Cruise Cake,"/);
  });

  it('lists related episodes, without the episode itself', () => {
    expect(details.related).toContain('Buca di Beppo with Drew McWeeny');
    expect(details.related).not.toContain('Alamo Drafthouse with Drew McWeeny');
  });

  it('leaves out sections a page doesn’t have', () => {
    const minimal = parseEpisodePage('x', '{{InfoboxEp|ep_number=1}}')!.details;
    expect(minimal).toEqual({ quotes: [], roasts: [], related: [] });
  });

  it('drops leftover italic and bold markup', () => {
    const text =
      "{{InfoboxEp|ep_number=1}}\n== Synopsis ==\nA ''great'' and '''bold''' show.\n== Quotes ==\n{{Quote|It's ''so'' good.|Mitch}}";
    const parsed = parseEpisodePage('x', text)!.details!;
    expect(parsed.synopsis).toBe('A great and bold show.');
    expect(parsed.quotes).toEqual([{ text: "It's so good.", author: 'Mitch' }]);
  });
});
