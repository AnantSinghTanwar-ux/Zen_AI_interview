import { type Request, type Response, type NextFunction } from 'express';
import { UserModel } from '../models/user.model';

/**
 * Middleware to enforce email requirement for specific endpoints.
 * Prevents OAuth users with is_email_dummy=true from using email-dependent features.
 *
 * Usage:
 *   router.post('/apply', requireEmail, applicationController.create);
 *   router.post('/jobs', requireEmail, jobController.create);
 */
export const requireEmail = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  void (async () => {
    const user = await UserModel.findById(userId);

    if (!user?.email || !user.email_verified) {
      res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email to continue',
        requiresVerification: true,
      });
      return;
    }

    next();
  })().catch(next);
};
