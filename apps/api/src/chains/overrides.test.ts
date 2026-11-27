import { describe, expect, it } from 'vitest';
import { withOverrides } from './overrides.js';

describe('withOverrides', () => {
  it('corrects classified chains and can add missing ones', () => {
    const map = withOverrides([{ name: 'AEW Dynamite', category: 'other', domain: null }], {
      'AEW Dynamite': { category: 'restaurant' },
      'New Place': { domain: 'newplace.com' },
    });
    expect(map.get('AEW Dynamite')).toEqual({
      name: 'AEW Dynamite',
      category: 'restaurant',
      domain: null,
    });
    expect(map.get('New Place')).toEqual({
      name: 'New Place',
      category: 'restaurant',
      domain: 'newplace.com',
    });
  });
});
