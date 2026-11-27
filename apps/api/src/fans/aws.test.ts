import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { CognitoAccountDirectory } from './cognito.js';
import { DynamoRatingStore } from './dynamo.js';

const ddb = mockClient(DynamoDBDocumentClient);
const cognito = mockClient(CognitoIdentityProviderClient);

beforeEach(() => {
  ddb.reset();
  cognito.reset();
});

describe('DynamoRatingStore', () => {
  const store = new DynamoRatingStore(
    'Ratings',
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
  );

  it('reads a chain’s ratings by key and a fan’s through the byUser index', async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    await store.forChain('taco-bell');
    await store.forUser('alice');
    const [chain, user] = ddb.commandCalls(QueryCommand).map((c) => c.args[0].input);
    expect(chain).toMatchObject({ ExpressionAttributeValues: { ':chain': 'taco-bell' } });
    expect(chain).not.toHaveProperty('IndexName');
    expect(user).toMatchObject({
      IndexName: 'byUser',
      ExpressionAttributeValues: { ':userId': 'alice' },
    });
  });
});

describe('CognitoAccountDirectory', () => {
  const directory = new CognitoAccountDirectory('pool-1', new CognitoIdentityProviderClient({}));

  it('deletes the user by their sub', async () => {
    cognito.on(AdminDeleteUserCommand).resolves({});
    await directory.deleteAccount('sub-123');
    expect(cognito.commandCalls(AdminDeleteUserCommand)[0]!.args[0].input).toEqual({
      UserPoolId: 'pool-1',
      Username: 'sub-123',
    });
  });

  it('treats an already deleted account as done', async () => {
    cognito
      .on(AdminDeleteUserCommand)
      .rejects(new UserNotFoundException({ message: 'gone', $metadata: {} }));
    await expect(directory.deleteAccount('sub-123')).resolves.toBeUndefined();
  });
});
