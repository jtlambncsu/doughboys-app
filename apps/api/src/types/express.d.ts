import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

declare global {
  namespace Express {
    interface Request {
      /** The API Gateway event, when running in Lambda (set in lambda.ts). */
      lambdaEvent?: APIGatewayProxyEventV2WithJWTAuthorizer;
    }
  }
}

export {};
