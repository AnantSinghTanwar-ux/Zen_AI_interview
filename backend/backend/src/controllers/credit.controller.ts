import { Request, Response, NextFunction } from 'express';
import { CreditService } from '../services/credit.service';
import { UserService } from '../services/user.service';
import { sendSuccess, sendPaginated } from '../utils/response';

const MAX_LEDGER_LIMIT = 100;

export const CreditController = {
  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const { balance, low_credit } = await CreditService.getBalanceState(req.user!.userId);
      sendSuccess(res, { balance, low_credit });
    } catch (err) {
      next(err);
    }
  },

  async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const rawLimit = parseInt(req.query.limit as string, 10) || 20;
      const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 20, MAX_LEDGER_LIMIT);
      const { transactions, total } = await CreditService.getLedger(req.user!.userId, page, limit);
      sendPaginated(res, transactions, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async claimCompleteProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role as 'applicant' | 'recruiter' | 'admin';
      const profileState = await UserService.getProfile(userId, role);
      const completeness =
        typeof (profileState as { completeness?: unknown }).completeness === 'number'
          ? (profileState as { completeness: number }).completeness
          : 0;

      if (completeness < 100) {
        return res.status(400).json({
          success: false,
          message: 'Complete your profile to 100% to claim this bonus',
          code: 'PROFILE_INCOMPLETE',
        });
      }

      const result = await CreditService.grantCompleteProfileBonus(userId);
      sendSuccess(res, {
        awarded: result.awarded,
        credits_earned: result.amount,
        message: result.awarded
          ? 'Complete profile bonus credited'
          : 'Complete profile bonus already claimed',
      });
    } catch (err) {
      next(err);
    }
  },

  async claimInstagramFollow(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CreditService.grantInstagramFollowBonus(req.user!.userId);
      sendSuccess(res, {
        awarded: result.awarded,
        credits_earned: result.amount,
        message: result.awarded
          ? 'Instagram follow bonus credited'
          : 'Instagram follow bonus already claimed',
      });
    } catch (err) {
      next(err);
    }
  },
};
