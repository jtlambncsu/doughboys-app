import type { Request, RequestHandler } from 'express';

/** Works out which fan made a request, or `undefined` if nobody is signed in. */
export type ResolveUser = (req: Request) => string | undefined;

/**
 * In AWS, API Gateway has already verified the Cognito access token before the request
 * reaches Lambda (on the signed-in routes only), and passes its claims along with the
 * event. We only read `sub` from it. On public routes there are no claims: nobody.
 */
export const userFromApiGateway: ResolveUser = (req) => {
  const claims = req.lambdaEvent?.requestContext.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  return typeof sub === 'string' && sub.length > 0 ? sub : undefined;
};

/** Local development has no Cognito, so every request comes from one fixed fan. */
export const LOCAL_DEV_USER = 'local-dev-user';
export const localDevUser: ResolveUser = () => LOCAL_DEV_USER;

/** Nobody is ever signed in (the default, so a misconfigured app fails closed). */
export const noUser: ResolveUser = () => undefined;

/** Rejects unauthenticated requests and exposes the user ID as `res.locals.userId`. */
export function requireUser(resolveUser: ResolveUser): RequestHandler {
  return (req, res, next) => {
    const userId = resolveUser(req);
    if (!userId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    res.locals.userId = userId;
    next();
  };
}
