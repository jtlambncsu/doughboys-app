import { describe, expect, it } from 'vitest';
import { audienceScore, buildMenu, displayNameSchema, ratingInputSchema } from './ratings.js';

describe('ratingInputSchema', () => {
  it('accepts half forks and trims text, treating blanks as missing', () => {
    expect(
      ratingInputSchema.parse({
        forks: 3.5,
        ordered: [' Crunchwrap Supreme '],
        review: '  Great!  ',
        location: '',
      }),
    ).toEqual({ forks: 3.5, ordered: ['Crunchwrap Supreme'], review: 'Great!' });
  });

  it.each([[5.5], [-1], [3.3], [Number.NaN]])('rejects %d forks', (forks) => {
    expect(ratingInputSchema.safeParse({ forks }).success).toBe(false);
  });

  it('limits sizes', () => {
    expect(ratingInputSchema.safeParse({ forks: 3, review: 'x'.repeat(501) }).success).toBe(false);
    expect(ratingInputSchema.safeParse({ forks: 3, ordered: Array(13).fill('Taco') }).success).toBe(
      false,
    );
    expect(ratingInputSchema.safeParse({ forks: 3, location: 'x'.repeat(81) }).success).toBe(false);
  });

  it('ignores unknown fields', () => {
    expect(ratingInputSchema.parse({ forks: 4, userId: 'someone-else' })).not.toHaveProperty(
      'userId',
    );
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

describe('buildMenu', () => {
  it('merges spelling variants and ranks by how often each was ordered', () => {
    expect(
      buildMenu([
        ['Crunchwrap Supreme', 'Baja Blast'],
        ['crunchwrap supreme', 'Nachos BellGrande'],
        ['Crunchwrap Supreme', 'Crunchwrap Supreme'], // counted once per order
      ]),
    ).toEqual([
      { name: 'Crunchwrap Supreme', count: 3 },
      { name: 'Baja Blast', count: 1 },
      { name: 'Nachos BellGrande', count: 1 },
    ]);
  });
});
