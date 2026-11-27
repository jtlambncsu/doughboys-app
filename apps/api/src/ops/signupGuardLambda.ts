import { createSignupGuard, DynamoSignupCounter } from './signupGuard.js';

const limit = Number(process.env.MAX_SIGNUPS_PER_DAY ?? 50);

export const handler = createSignupGuard(
  new DynamoSignupCounter(process.env.SIGNUP_COUNTS_TABLE!),
  Number.isFinite(limit) && limit > 0 ? limit : 50,
);
