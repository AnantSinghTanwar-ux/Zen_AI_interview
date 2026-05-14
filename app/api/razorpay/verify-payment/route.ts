import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  verifyRazorpaySignature,
  getProductById,
  grantCredits,
  isPaymentAlreadyProcessed,
  incrementLimitedOfferCount,
} from "@/lib/services/payment.service";

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Rate limit
    const { allowed, response } = await checkRateLimit(
      request,
      user.id,
      "razorpay-verify-payment"
    );
    if (!allowed) return response!;

    // 3. Parse & validate all required fields
    const body = await request.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      productId,
    } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment verification fields" },
        { status: 400 }
      );
    }

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "Missing productId" },
        { status: 400 }
      );
    }

    const product = getProductById(productId);
    if (!product) {
      return NextResponse.json(
        { error: "Invalid product" },
        { status: 400 }
      );
    }

    // 4. Check for replay attack — prevent double-processing
    const alreadyProcessed = await isPaymentAlreadyProcessed(
      razorpay_payment_id,
      user.id
    );
    if (alreadyProcessed) {
      return NextResponse.json(
        { error: "Payment already processed" },
        { status: 409 }
      );
    }

    // 5. Verify signature using HMAC-SHA256
    const isValid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      console.error(
        `Signature verification failed for payment ${razorpay_payment_id}, user ${user.id}`
      );
      return NextResponse.json(
        { error: "Payment verification failed — signature mismatch" },
        { status: 400 }
      );
    }

    // 6. Grant credits to user
    const updatedCredits = await grantCredits({
      userId: user.id,
      creditType: product.creditType,
      amount: product.credits,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      productId: product.id,
    });

    console.log(
      `Payment verified: ${razorpay_payment_id} → granted ${product.credits} ${product.creditType} to ${user.id}`
    );

    // If it was a limited offer interview, increment the global counter
    if (product.id === "limited_offer_interview") {
      await incrementLimitedOfferCount().catch((err) =>
        console.error("Failed to increment limited offer count:", err)
      );
    }

    // 7. Return success with updated credits
    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      credits: updatedCredits,
      product: {
        id: product.id,
        name: product.name,
        creditsGranted: product.credits,
      },
    });
  } catch (error) {
    console.error("Verify payment error:", error);

    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    );
  }
}
