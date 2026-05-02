import { Request, Response, NextFunction } from 'express';
import { CreditService } from '../services/credit.service';

export const requireCredits = (requiredCredits: number) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const balance = await CreditService.getBalance(req.user.userId);
      if (balance < requiredCredits) {
        res.status(402).json({
          success: false,
          error: 'INSUFFICIENT_CREDITS',
          message: 'Insufficient credits',
          required: requiredCredits,
          available: balance,
        });
        return;
      }

      next();
    } catch (err) {
      const anyErr = err as { statusCode?: number; code?: string };
      if (anyErr.statusCode === 404) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Credit validation failed',
      });
    }
  };
};

