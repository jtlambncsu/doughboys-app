import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Cognito's managed login refuses images outside these width:height ratios (ADR 0015).
const size = (name: string) => {
  const svg = readFileSync(new URL(`../branding/${name}`, import.meta.url), 'utf8');
  const tag = /<svg[^>]*>/.exec(svg)![0];
  const num = (attr: string) => Number(new RegExp(`\\b${attr}="([\\d.]+)"`).exec(tag)![1]);
  return num('width') / num('height');
};

describe('sign-in page images', () => {
  it.each(['logo-light.svg', 'logo-dark.svg'])('%s is between 1:1 and 4:1', (name) => {
    expect(size(name)).toBeGreaterThanOrEqual(1);
    expect(size(name)).toBeLessThanOrEqual(4);
  });

  it('favicon is square', () => {
    expect(size('favicon.svg')).toBe(1);
  });
});
