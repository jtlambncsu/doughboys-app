import { describe, expect, it } from 'vitest';
import {
  audienceScore,
  displayNameSchema,
  forksAndTines,
  ratingInputSchema,
  reportInputSchema,
  tineLabel,
} from './ratings.js';

describe('ratingInputSchema', () => {
  it('accepts half forks and trims text, treating blanks as missing', () => {
    expect(
      ratingInputSchema.parse({
        forks: 3.5,
        review: '  Great!  ',
        location: '',
      }),
    ).toEqual({ forks: 3.5, review: 'Great!' });
  });

  it.each([[3.25], [3.5], [4.75], [0], [5]])('accepts %d forks (whole tines)', (forks) => {
    expect(ratingInputSchema.safeParse({ forks }).success).toBe(true);
  });

  it.each([[5.25], [-0.25], [3.3], [3.1], [Number.NaN]])('rejects %d forks', (forks) => {
    expect(ratingInputSchema.safeParse({ forks }).success).toBe(false);
  });

  it('limits sizes', () => {
    expect(ratingInputSchema.safeParse({ forks: 3, review: 'x'.repeat(501) }).success).toBe(false);
    expect(ratingInputSchema.safeParse({ forks: 3, location: 'x'.repeat(81) }).success).toBe(false);
  });

  it('ignores unknown fields, including the retired order list', () => {
    const parsed = ratingInputSchema.parse({ forks: 4, userId: 'someone-else', ordered: ['Taco'] });
    expect(parsed).toEqual({ forks: 4 });
  });
});

describe('displayNameSchema', () => {
  it.each(['Spoonman', 'José García', 'mitch_fan.99', "D'Arcy"])('accepts %j', (name) => {
    expect(displayNameSchema.safeParse(name).success).toBe(true);
  });

  it.each(['x', 'a'.repeat(31), '<script>', 'https://spam.example', ' ', '-dash'])(
    'rejects %j',
    (name) => {
      expect(displayNameSchema.safeParse(name).success).toBe(false);
    },
  );
});

describe('audienceScore', () => {
  it('hides the average until three fans have rated', () => {
    expect(audienceScore([5, 4])).toEqual({ average: null, count: 2 });
    expect(audienceScore([5, 4, 3.5])).toEqual({ average: 4.17, count: 3 });
  });
});

describe('tines', () => {
  it.each([
    [3.25, { forks: 3, tines: 1 }, '3 forks, 1 tine'],
    [3.5, { forks: 3, tines: 2 }, '3 forks, 2 tines'],
    [4.75, { forks: 4, tines: 3 }, '4 forks, 3 tines'],
    [1, { forks: 1, tines: 0 }, '1 fork'],
    [0.25, { forks: 0, tines: 1 }, '1 tine'],
    [0, { forks: 0, tines: 0 }, '0 forks'],
    [3.83, { forks: 3, tines: 3 }, '3 forks, 3 tines'], // averages round to the nearest tine
  ])('%d is %o, "%s"', (value, parts, label) => {
    expect(forksAndTines(value)).toEqual(parts);
    expect(tineLabel(value)).toBe(label);
  });
});

describe('reportInputSchema', () => {
  it('needs a known reason and limits the note', () => {
    expect(reportInputSchema.parse({ reason: 'spam', note: '  buy pills  ' })).toEqual({
      reason: 'spam',
      note: 'buy pills',
    });
    expect(reportInputSchema.parse({ reason: 'other', note: '' })).toEqual({ reason: 'other' });
    expect(reportInputSchema.safeParse({ reason: 'meh' }).success).toBe(false);
    expect(reportInputSchema.safeParse({ reason: 'spam', note: 'x'.repeat(301) }).success).toBe(
      false,
    );
  });
});
