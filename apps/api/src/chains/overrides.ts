import type { ChainInfo } from '@doughboys-app/shared';

/**
 * Hand corrections, applied on top of Claude's classification every time chains are served,
 * so a fix here takes effect on the next deploy without re-running anything. Keyed by the
 * restaurant name exactly as the wiki's Restaurants list writes it.
 *
 * Example: 'Some Chain': { category: 'restaurant', domain: 'somechain.com' },
 */
export const CHAIN_OVERRIDES: Record<string, Partial<Omit<ChainInfo, 'name'>>> = {};

export function withOverrides(
  chains: ChainInfo[],
  overrides: typeof CHAIN_OVERRIDES = CHAIN_OVERRIDES,
): Map<string, ChainInfo> {
  const byName = new Map(chains.map((chain) => [chain.name, chain]));
  for (const [name, fix] of Object.entries(overrides)) {
    const base = byName.get(name) ?? { name, category: 'restaurant' as const, domain: null };
    byName.set(name, { ...base, ...fix });
  }
  return byName;
}
