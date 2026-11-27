import { publishStats } from './stats.js';

export const handler = () =>
  publishStats({
    userPoolId: process.env.USER_POOL_ID!,
    ratingsTable: process.env.RATINGS_TABLE!,
    profilesTable: process.env.PROFILES_TABLE!,
  });
