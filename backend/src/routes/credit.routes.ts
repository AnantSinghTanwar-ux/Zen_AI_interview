import { Router } from 'express';
import { CreditController } from '../controllers/credit.controller';
import { authenticate } from '../middleware/auth';
import { requireEmail } from '../middleware/requireEmail';

const router = Router();

router.use(authenticate, requireEmail);
router.get('/balance', CreditController.getBalance);
router.get('/ledger', CreditController.getLedger);
router.get('/history', CreditController.getLedger);
router.post('/earn/complete-profile', CreditController.claimCompleteProfile);
router.post('/earn/follow-instagram', CreditController.claimInstagramFollow);

export default router;
