const API_URL = 'https://doughboys.fandom.com/api.php';

/** A wiki page's title and current source. */
export interface WikiPage {
  title: string;
  wikitext: string;
}

/** What the importer needs from the wiki. Tests pass a fake. */
export interface WikiSource {
  /** Every page that uses the episode infobox template. */
  episodePages(): AsyncIterable<WikiPage>;
  page(title: string): Promise<WikiPage | undefined>;
}

interface RevisionsResponse {
  continue?: Record<string, string>;
  query?: {
    pages?: {
      title: string;
      missing?: boolean;
      revisions?: { slots: { main: { content: string } } }[];
    }[];
  };
}

/**
 * Reads the Doughboys Wikia through its MediaWiki API (not by scraping HTML). Pages come 50
 * at a time, with a pause between requests so a full import stays gentle on the wiki.
 */
export class MediaWikiSource implements WikiSource {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly pauseMs = 500,
  ) {}

  private async get(params: Record<string, string>): Promise<RevisionsResponse> {
    const url = new URL(API_URL);
    url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();
    const response = await this.fetchImpl(url, {
      // Wikis ask automated clients to identify themselves.
      headers: { 'User-Agent': 'doughboys-app-importer/0.1 (fan project; read-only)' },
    });
    if (!response.ok) throw new Error(`Wiki API ${response.status} for ${url}`);
    return (await response.json()) as RevisionsResponse;
  }

  private static pagesOf(data: RevisionsResponse): WikiPage[] {
    return (data.query?.pages ?? []).flatMap((page) => {
      const content = page.revisions?.[0]?.slots.main.content;
      return content === undefined ? [] : [{ title: page.title, wikitext: content }];
    });
  }

  async *episodePages(): AsyncIterable<WikiPage> {
    let next: Record<string, string> | undefined = {};
    while (next) {
      const data = await this.get({
        action: 'query',
        generator: 'embeddedin',
        geititle: 'Template:InfoboxEp',
        geinamespace: '0',
        geilimit: '50',
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        ...next,
      });
      yield* MediaWikiSource.pagesOf(data);
      next = data.continue;
      if (next && this.pauseMs) await new Promise((resolve) => setTimeout(resolve, this.pauseMs));
    }
  }

  async page(title: string): Promise<WikiPage | undefined> {
    const data = await this.get({
      action: 'query',
      titles: title,
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
    });
    return MediaWikiSource.pagesOf(data)[0];
  }
}
