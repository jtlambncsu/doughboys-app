import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  BatchWriteCommand,
  GetCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Episode } from '@doughboys-app/shared';
import { DynamoEpisodeStore } from './dynamo.js';

const ddb = mockClient(DynamoDBDocumentClient);
const store = new DynamoEpisodeStore(
  'Episodes',
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
);

const episode = (slug: string, releaseDate: string): Episode => ({
  slug,
  title: slug,
  series: 'main',
  releaseDate,
  guests: [],
  ratings: [{ person: 'Nick Wiger', forks: 4, unit: 'forks', raw: '4 forks', ordered: [] }],
  wikiUrl: `https://doughboys.fandom.com/wiki/${slug}`,
});

beforeEach(() => ddb.reset());

describe('DynamoEpisodeStore', () => {
  it('writes in batches of 25 and retries unprocessed items', async () => {
    const episodes = Array.from({ length: 30 }, (_, i) => episode(`e${i}`, '2020-01-01'));
    ddb
      .on(BatchWriteCommand)
      .resolvesOnce({
        UnprocessedItems: { Episodes: [{ PutRequest: { Item: episodes[0] } }] },
      })
      .resolves({});

    await store.putEpisodes(episodes);

    const calls = ddb.commandCalls(BatchWriteCommand);
    expect(calls.map((c) => c.args[0].input.RequestItems!.Episodes!.length)).toEqual([25, 1, 5]);
  });

  it('lists every page of a scan, newest first, without orders', async () => {
    ddb
      .on(ScanCommand)
      .resolvesOnce({ Items: [episode('old', '2015-01-01')], LastEvaluatedKey: { slug: 'old' } })
      .resolves({ Items: [episode('new', '2025-01-01')] });

    const list = await store.listEpisodes();

    const input = ddb.commandCalls(ScanCommand)[0]!.args[0].input;
    expect(Object.values(input.ExpressionAttributeNames!)).toContain('number');
    expect(Object.values(input.ExpressionAttributeNames!)).not.toContain('details');

    expect(list.map((e) => e.slug)).toEqual(['new', 'old']);
    expect(list[0]).not.toHaveProperty('ratings');
  });

  it('gets one episode by slug', async () => {
    ddb
      .on(GetCommand, { TableName: 'Episodes', Key: { slug: 'a' } })
      .resolves({ Item: episode('a', '2020-01-01') });
    expect(await store.getEpisode('a')).toMatchObject({ slug: 'a' });
  });

  it('reads several episodes at once and retries unprocessed keys', async () => {
    ddb
      .on(BatchGetCommand)
      .resolvesOnce({
        Responses: { Episodes: [episode('a', '2020-01-01')] },
        UnprocessedKeys: { Episodes: { Keys: [{ slug: 'b' }] } },
      })
      .resolves({ Responses: { Episodes: [episode('b', '2021-01-01')] } });

    const result = await store.getEpisodes(['a', 'b']);

    expect(result.map((e) => e.slug)).toEqual(['a', 'b']);
    expect(ddb.commandCalls(BatchGetCommand)).toHaveLength(2);
  });
});
