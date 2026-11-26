import { describe, expect, it } from 'vitest';
import { assertOrigins, listSetting } from '../lib/config.js';

describe('listSetting', () => {
  it('splits and trims a comma-separated value', () => {
    expect(listSetting(' https://a.example , https://b.example ')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('falls through blank values, like an unset GitHub variable', () => {
    expect(listSetting(undefined, '', '  ', 'https://default.example')).toEqual([
      'https://default.example',
    ]);
  });

  it('returns undefined when nothing is set', () => {
    expect(listSetting(undefined, '')).toBeUndefined();
  });
});

describe('assertOrigins', () => {
  it('accepts bare origins', () => {
    const origins = ['https://doughboysapp.com', 'http://localhost:5173'];
    expect(assertOrigins(origins, 'ALLOWED_ORIGINS')).toEqual(origins);
  });

  it.each([
    'https//www.doughboysapp.com', // the real typo that failed a deploy
    'https://doughboysapp.com/',
    'doughboysapp.com',
    'ftp://doughboysapp.com',
  ])('rejects %j with a clear message', (origin) => {
    expect(() => assertOrigins([origin], 'ALLOWED_ORIGINS')).toThrow(/isn't a valid origin/);
  });
});
