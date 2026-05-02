import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: errors.array().map((e) => ({
        field: (e as unknown as { path?: string; param?: string; type?: string }).path ??
          (e as unknown as { param?: string }).param ??
          (e as unknown as { type?: string }).type ??
          'unknown',
        message: e.msg,
      })),
    });
    return;
  }
  next();
};
