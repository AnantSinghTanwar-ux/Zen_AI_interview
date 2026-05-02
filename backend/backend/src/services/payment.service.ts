import crypto from 'crypto';
import Razorpay from 'razorpay';
import { PaymentModel } from '../models/payment.model';
import { CreditService } from './credit.service';
import { NotificationModel } from '../models/notification.model';
import { AppError } from '../utils/appError';

const getRazorpay = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new AppError('Razorpay is not configured', 500);
  }

  return {
    keyId,
    keySecret,
    client: new Razorpay({ key_id: keyId, key_secret: keySecret }),
  };
};

const verifyWebhookSignature = (payload: string, signatureHeader: unknown) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new AppError('Razorpay webhook secret is not configured', 500);
  }

  if (typeof signatureHeader !== 'string' || !signatureHeader.trim()) {
    throw new AppError('Missing Razorpay signature header', 400);
  }

  const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  const received = signatureHeader.trim();

  if (expected !== received) {
    throw new AppError('Invalid Razorpay webhook signature', 400);
  }
};

export const PaymentService = {
  async getPlans() {
    await PaymentModel.ensureDefaultPlans();
    return PaymentModel.getActivePlans();
  },

  async initiateCheckout(userId: string, planId: string) {
    const { client, keyId } = getRazorpay();
    const plan = await PaymentModel.findPlanById(planId);
    if (!plan) throw new AppError('Plan not found', 404);

    const payment = await PaymentModel.createPayment({
      user_id: userId,
      plan_id: planId,
      amount: plan.price,
      currency: plan.currency.toUpperCase(),
    });

    const amountInPaise = Math.round(Number(plan.price) * 100);
    const order = await client.orders.create({
      amount: amountInPaise,
      currency: plan.currency.toUpperCase(),
      receipt: payment.id,
      notes: {
        paymentId: payment.id,
        userId,
        planId,
      },
    });

    await PaymentModel.updateStatus(payment.id, 'pending', order.id);

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      amount: amountInPaise,
      currency: plan.currency.toUpperCase(),
      keyId,
      plan: {
        id: plan.id,
        name: plan.name,
        credits: plan.credits,
      },
    };
  },

  async verifyCheckout(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const { keySecret } = getRazorpay();

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== params.razorpaySignature) {
      await PaymentService.handleWebhookFailure(params.razorpayOrderId);
      throw new AppError('Payment signature verification failed', 400);
    }

    await PaymentService.handleWebhookSuccess(params.razorpayOrderId);
    return { verified: true };
  },

  async handleWebhookEvent(rawBody: string, signatureHeader: unknown) {
    verifyWebhookSignature(rawBody, signatureHeader);

    const payload = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string } };
        order?: { entity?: { id?: string } };
      };
    };

    const event = payload.event || 'unknown';
    const paymentOrderId = payload.payload?.payment?.entity?.order_id;
    const orderEntityId = payload.payload?.order?.entity?.id;
    const gatewayRef = paymentOrderId || orderEntityId;

    if (!gatewayRef) {
      return { received: true, event, handled: false, reason: 'missing_gateway_ref' };
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      await PaymentService.handleWebhookSuccess(gatewayRef);
      return { received: true, event, handled: true };
    }

    if (event === 'payment.failed' || event === 'order.failed') {
      await PaymentService.handleWebhookFailure(gatewayRef);
      return { received: true, event, handled: true };
    }

    return { received: true, event, handled: false, reason: 'ignored_event' };
  },

  async handleWebhookSuccess(gatewayRef: string) {
    const payment = await PaymentModel.findByGatewayRef(gatewayRef);
    if (!payment || payment.status === 'success') return;

    await PaymentModel.updateStatus(payment.id, 'success');
    const plan = payment.plan_id ? await PaymentModel.findPlanById(payment.plan_id) : null;
    if (plan) {
      await CreditService.grantPlanCredits(payment.user_id, plan.credits, payment.id);
      await NotificationModel.create({
        user_id: payment.user_id,
        type: 'payment_success',
        title: 'Payment successful',
        body: `${plan.credits} credits have been added to your account.`,
        action_url: '/credits',
      });
    }
  },

  async handleWebhookFailure(gatewayRef: string) {
    const payment = await PaymentModel.findByGatewayRef(gatewayRef);
    if (!payment) return;
    await PaymentModel.updateStatus(payment.id, 'failed');
    await NotificationModel.create({
      user_id: payment.user_id,
      type: 'payment_failed',
      title: 'Payment failed',
      body: 'Your payment could not be processed. Please try again.',
      action_url: '/credits',
    });
  },

  async getHistory(userId: string, page: number, limit: number) {
    return PaymentModel.getHistory(userId, page, limit);
  },
};
