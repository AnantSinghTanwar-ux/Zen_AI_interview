import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { sendSuccess, sendPaginated } from '../utils/response';

export const PaymentController = {
  async getPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await PaymentService.getPlans();
      sendSuccess(res, plans);
    } catch (err) {
      next(err);
    }
  },

  async initiateCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await PaymentService.initiateCheckout(req.user!.userId, req.body.planId);
      sendSuccess(res, data, 'Checkout initiated', 201);
    } catch (err) {
      next(err);
    }
  },

  async verifyCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await PaymentService.verifyCheckout({
        razorpayOrderId: req.body.razorpay_order_id,
        razorpayPaymentId: req.body.razorpay_payment_id,
        razorpaySignature: req.body.razorpay_signature,
      });
      sendSuccess(res, data, 'Payment verified');
    } catch (err) {
      next(err);
    }
  },

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body ?? {});

      const data = await PaymentService.handleWebhookEvent(rawBody, signature);
      sendSuccess(res, data, 'Webhook received');
    } catch (err) {
      next(err);
    }
  },

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { payments, total } = await PaymentService.getHistory(req.user!.userId, page, limit);
      sendPaginated(res, payments, total, page, limit);
    } catch (err) {
      next(err);
    }
  },
};
