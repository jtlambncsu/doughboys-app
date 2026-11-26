import { describe, expect, it } from 'vitest';
import { matches } from './search';

describe('matches', () => {
  it('ignores case, accents and apostrophes, and needs every word', () => {
    expect(matches('chilis eva', 'Chili’s with Eva Anderson')).toBe(true);
    expect(matches('rodriguez', 'Tony Rodríguez')).toBe(true);
    expect(matches('chilis nick', 'Chili’s with Eva Anderson')).toBe(false);
    expect(matches('', 'anything')).toBe(true);
  });
});
