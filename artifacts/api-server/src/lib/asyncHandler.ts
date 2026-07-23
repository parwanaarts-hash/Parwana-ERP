/**
 * asyncHandler — wraps an async Express route handler so that any rejected
 * promise is forwarded to `next(err)`, reaching the global error handler.
 *
 * Without this wrapper, Express 4 silently swallows async errors.
 *
 * @example
 *   router.get("/things/:id", asyncHandler(async (req, res) => {
 *     const result = await thingService.get(Number(req.params.id));
 *     res.json(result);
 *   }));
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler(fn: AsyncRouteHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
