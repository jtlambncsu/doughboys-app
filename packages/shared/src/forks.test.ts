import { describe, expect, it } from 'vitest';
import { averageForks, parseForks } from './forks.js';

describe('parseForks', () => {
  it.each([
    ['4 forks', 4],
    ['3.5 forks', 3.5],
    ['1 fork', 1],
    ['4½ forks', 4.5],
    ['4 ½ forks', 4.5],
    ['-1 forks', -1],
    ['4.25 forks (revised from 4)', 4.25],
  ])('reads %j as %d', (raw, forks) => {
    expect(parseForks(raw)).toBe(forks);
  });

  it.each(['-', '', 'N/A', 'no rating'])('returns null for %j', (raw) => {
    expect(parseForks(raw)).toBeNull();
  });
});

describe('averageForks', () => {
  it('averages numeric ratings and skips missing ones', () => {
    expect(averageForks([{ forks: 4 }, { forks: 3.5 }, { forks: null }, { forks: 4 }])).toBe(3.83);
  });

  it('leaves out joke scores off the 0-5 scale', () => {
    expect(averageForks([{ forks: 4 }, { forks: 100 }, { forks: -1 }])).toBe(4);
  });

  it('is undefined with no numbers', () => {
    expect(averageForks([{ forks: null }])).toBeUndefined();
  });
});
