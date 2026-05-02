import { NextFunction, Request, Response } from 'express';

/**
 * Wrap async route handlers so rejected promises hit Express error middleware.
 */
export const asyncHandler =
  <
    Req extends Request = Request,
    Res extends Response = Response,
  >(
    fn: (req: Req, res: Res, next: NextFunction) => Promise<unknown>,
  ) =>
  (req: Req, res: Res, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

