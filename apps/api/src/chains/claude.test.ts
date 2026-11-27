import { describe, expect, it, vi } from 'vitest';
import { apiKeyFromSsm, ClaudeChainClassifier, cleanDomain } from './claude.js';

describe('cleanDomain', () => {
  it.each([
    ['tacobell.com', 'tacobell.com'],
    ['https://www.TacoBell.com/menu', 'tacobell.com'],
    ['order.chipotle.com', 'order.chipotle.com'],
    [' ', null],
    ['not a domain', null],
    [null, null],
  ])('%j → %j', (input, expected) => {
    expect(cleanDomain(input)).toBe(expected);
  });
});

/** A fake Messages API response carrying structured output. */
function messageResponse(chains: unknown) {
  return new Response(
    JSON.stringify({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [{ type: 'text', text: JSON.stringify({ chains }) }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('ClaudeChainClassifier', () => {
  it('asks once per batch, cleans domains, and drops names it was not asked about', async () => {
    const bodies: { messages: { content: string }[] }[] = [];
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return messageResponse([
        { name: 'Taco Bell', category: 'restaurant', domain: 'https://www.tacobell.com/' },
        { name: 'Kiwi', category: 'produce', domain: null },
        { name: 'Made Up', category: 'restaurant', domain: null },
      ]);
    });
    const classifier = new ClaudeChainClassifier(async () => 'key', { fetch });

    const result = await classifier.classify([
      { name: 'Taco Bell', episodeTitles: ['Taco Bell with Jack Allison'] },
      { name: 'Kiwi', episodeTitles: ["Garden of Eatin': Tutti-Fruitti"] },
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(bodies[0]!.messages[0]!.content).toContain(
      '- Taco Bell (episodes: Taco Bell with Jack Allison)',
    );
    expect(result).toEqual([
      { name: 'Taco Bell', category: 'restaurant', domain: 'tacobell.com' },
      { name: 'Kiwi', category: 'produce', domain: null },
    ]);
  });

  it('splits many chains into batches of 40', async () => {
    const fetch = vi.fn(async () => messageResponse([]));
    const classifier = new ClaudeChainClassifier(async () => 'key', { fetch });
    await classifier.classify(
      Array.from({ length: 81 }, (_, i) => ({ name: `C${i}`, episodeTitles: [] })),
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe('apiKeyFromSsm', () => {
  it('trims whitespace a pasted key picked up', async () => {
    const ssm = { send: vi.fn(async () => ({ Parameter: { Value: ' sk-ant-key\n' } })) };
    expect(await apiKeyFromSsm('/key', ssm as never)()).toBe('sk-ant-key');
  });
});
