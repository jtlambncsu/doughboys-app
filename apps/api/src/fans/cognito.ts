import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import type { AccountDirectory } from './types.js';

/**
 * Deletes a fan's sign-in account. With email sign-in, a Cognito user's username is its
 * `sub`, which is the userId we store. Already gone counts as done.
 */
export class CognitoAccountDirectory implements AccountDirectory {
  constructor(
    private readonly userPoolId: string,
    private readonly client = new CognitoIdentityProviderClient({}),
  ) {}

  async deleteAccount(userId: string) {
    try {
      await this.client.send(
        new AdminDeleteUserCommand({ UserPoolId: this.userPoolId, Username: userId }),
      );
    } catch (error) {
      if (!(error instanceof UserNotFoundException)) throw error;
    }
  }
}
