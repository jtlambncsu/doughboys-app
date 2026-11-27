import type { ChainInfo } from '@doughboys-app/shared';

/** A chain to classify, with a few episode titles as context. */
export interface ChainToClassify {
  name: string;
  episodeTitles: string[];
}

/** Works out what kind of place each chain is, and its website. Claude in production. */
export interface ChainClassifier {
  classify(chains: ChainToClassify[]): Promise<ChainInfo[]>;
}

/** Where classified chains are kept, so each is classified once. */
export interface ChainStore {
  all(): Promise<ChainInfo[]>;
  put(chains: ChainInfo[]): Promise<void>;
}
