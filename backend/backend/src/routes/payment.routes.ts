import { Router } from 'express';
import { body } from 'express-validator';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/plans', PaymentController.getPlans);
router.post('/webhook', PaymentController.handleWebhook);

router.use(authenticate);
router.post('/checkout', body('planId').isUUID(), validate, PaymentController.initiateCheckout);
router.post(
	'/verify',
	body('razorpay_order_id').isString().notEmpty(),
	body('razorpay_payment_id').isString().notEmpty(),
	body('razorpay_signature').isString().notEmpty(),
	validate,
	PaymentController.verifyCheckout,
);
router.get('/history', PaymentController.getHistory);

export default router;
