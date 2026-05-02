import { Request, Response, NextFunction } from 'express';
import { ReferralService } from '../services/referral.service';
import { sendSuccess } from '../utils/response';

export const ReferralController = {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReferralService.getDashboard(req.user!.userId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async redeemCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string' || code.trim() === '') {
        return res.status(400).json({ error: 'Referral code is required' });
      }

      const data = await ReferralService.redeemCode(req.user!.userId, code.trim());
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getRedemptionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReferralService.getRedemptionStatus(req.user!.userId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
};
