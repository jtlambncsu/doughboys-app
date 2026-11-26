import serverless from 'serverless-http';
import { createApp } from './app.js';
import { depsFromEnv } from './config.js';

// Created once per Lambda container and reused across requests.
export const handler = serverless(createApp(depsFromEnv()));
