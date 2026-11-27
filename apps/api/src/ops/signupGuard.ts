import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { PreSignUpTriggerEvent } from 'aws-lambda';

/** Thrown to Cognito, which shows the message on the sign-up page. */
export class SignupsPausedError extends Error {
  constructor() {
    super('New sign-ups are paused for today. Please try again tomorrow.');
  }
}

export interface SignupCounter {
  /** Counts one sign-up for `day`; false if the day's limit was already reached. */
  tryCount(day: string, limit: number): Promise<boolean>;
}

/**
 * One item per UTC day. `ADD` with a condition is atomic, so concurrent sign-ups can't race
 * past the limit. Items expire after a few days (TTL).
 */
export class DynamoSignupCounter implements SignupCounter {
  constructor(
    private readonly tableName: string,
    private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({})),
    private readonly now = () => Date.now(),
  ) {}

  async tryCount(day: string, limit: number) {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { day },
          UpdateExpression: 'ADD signups :one SET expiresAt = :expires',
          ConditionExpression: 'attribute_not_exists(signups) OR signups < :limit',
          ExpressionAttributeValues: {
            ':one': 1,
            ':limit': limit,
            ':expires': Math.floor(this.now() / 1000) + 7 * 24 * 60 * 60,
          },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }
}

/**
 * Cognito's pre sign-up trigger: refuses new accounts once today's cap is reached, so a bot
 * flood can't create thousands of accounts (and monthly-active-user charges). ADR 0013.
 */
export function createSignupGuard(counter: SignupCounter, limit: number, now = () => new Date()) {
  return async (event: PreSignUpTriggerEvent) => {
    // Only self sign-up is capped; accounts created by an admin are deliberate.
    if (event.triggerSource !== 'PreSignUp_SignUp') return event;
    const day = now().toISOString().slice(0, 10);
    if (!(await counter.tryCount(day, limit))) {
      console.warn(JSON.stringify({ message: 'Sign-up refused: daily limit reached', day, limit }));
      throw new SignupsPausedError();
    }
    return event;
  };
}
