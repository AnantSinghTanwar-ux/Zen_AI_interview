import { Router } from 'express';
import { ReferralController } from '../controllers/referral.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/dashboard', ReferralController.getDashboard);
router.post('/redeem', ReferralController.redeemCode);
router.get('/status', ReferralController.getRedemptionStatus);

export default router;
