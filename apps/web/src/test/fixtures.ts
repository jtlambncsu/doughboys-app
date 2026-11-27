import { db } from './server';

/** A few real-looking episodes. */
export function seedEpisodes() {
  db.add({
    slug: 'IHOP with Alison Agosti',
    title: 'IHOP with Alison Agosti',
    number: '3',
    releaseDate: '2015-05-28',
    restaurant: 'IHOP',
    guests: ['Alison Agosti', 'Dave Ferguson'],
    averageForks: 3.83,
    details: {
      synopsis:
        'Mitch and Nick welcome guest Alison Agosti to review IHOP.\n\nThey play Snack or Wack.',
      intro: 'The year was 1958.\n\nThe brothers opened a breakfast diner in Toluca Lake.',
      quotes: [
        { text: 'I am a gummy man.', author: 'Mike Mitchell' },
        { text: 'Mitch: Tip twenty percent.\nNick: At least.', author: 'The Doughboys' },
        { text: 'Pancakes are a vehicle.' },
        { text: 'A fourth quote.', author: 'Nick Wiger' },
      ],
      roasts: [{ text: 'A walking syrup spill', author: 'Jeffrey' }],
      snackOrWack: 'For this episode, they have SweeTarts Gummies.',
      related: ['Taco Bell with Jack Allison'],
    },
    ratings: [
      {
        person: 'Nick Wiger',
        forks: 4,
        unit: 'forks',
        raw: '4 forks',
        ordered: ['Coffee', 'Splashberry'],
      },
      { person: 'Mike Mitchell', forks: 3.5, unit: 'forks', raw: '3.5 forks', ordered: [] },
      { person: 'Alison Agosti', forks: null, unit: 'forks', raw: '-', ordered: [] },
    ],
  });
  db.add({
    slug: 'Taco Bell with Jack Allison',
    number: '1',
    releaseDate: '2015-05-14',
    restaurant: 'Taco Bell',
    averageForks: 4.5,
  });
  db.add({
    slug: 'RIP Mama Celeste with Sandy Honig',
    number: 'DD',
    series: 'double',
    releaseDate: '2026-11-10',
    guests: ['Sandy Honig'],
  });
}
