import type { ChainInfo } from '@doughboys-app/shared';
import type { ChainStore } from './types.js';

export class InMemoryChainStore implements ChainStore {
  private readonly chains = new Map<string, ChainInfo>();

  constructor(initial: ChainInfo[] = []) {
    for (const chain of initial) this.chains.set(chain.name, chain);
  }

  async all() {
    return [...this.chains.values()];
  }

  async put(chains: ChainInfo[]) {
    for (const chain of chains) this.chains.set(chain.name, chain);
  }
}
