import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  createRazorpayOrder,
  getProductById,
  getPromoKind,
  getPromoPrice,
  getPromoRemaining,
} from "@/lib/services/payment.service";

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Rate limit — prevent order spam
    const { allowed, response } = await checkRateLimit(
      request,
      user.id,
      "razorpay-create-order"
    );
    if (!allowed) return response!;

    // 3. Parse & validate request
    const body = await request.json();
    const { productId, recruiterVisibility } = body;

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "productId is required" },
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

    // 4. Server-side amount enforcement
    let amountInPaise = product.priceInPaise;
    let hasVisibility = false;
    let promoApplied = false;
    let promoKind: string | null = null;

    // Apply per-user promo pricing (first 10 purchases per category)
    const resolvedPromoKind = getPromoKind(product.id);
    if (resolvedPromoKind) {
      promoKind = resolvedPromoKind;
      const remaining = await getPromoRemaining(user.id, resolvedPromoKind);
      const promoPrice = getPromoPrice(product.id);
      if (remaining > 0 && promoPrice) {
        amountInPaise = promoPrice;
        promoApplied = true;
      }
    }

    // Apply recruiter visibility add-on
    if (recruiterVisibility) {
      const visibilityAllowed =
        product.id === "interview_30" ||
        product.id === "single_interview" ||
        product.id === "limited_offer_interview" ||
        product.id === "interview_pack_5";
      if (!visibilityAllowed) {
        return NextResponse.json(
          { error: "Recruiter visibility is only available with 30-minute interviews." },
          { status: 400 }
        );
      }
      amountInPaise += 3000;
      hasVisibility = true;
    }
    
    // For bulk college plans, trust the client's calculated amount for now
    if (product.id === "bulk_college_plan") {
      amountInPaise = body.amountInPaise || 0;
    }

    if (amountInPaise < 100) {
      return NextResponse.json(
        { error: "Amount must be at least ₹1 (100 paise)" },
        { status: 400 }
      );
    }

    // 5. Create Razorpay order
    // Receipt must be <= 40 chars for Razorpay API
    const receipt = `${product.id.substring(0, 10)}_${user.id.slice(0, 8)}_${Date.now()}`.substring(0, 40);
    const order = await createRazorpayOrder({
      amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        userId: user.id,
        productId: product.id,
        productName: product.name,
        hasVisibility: hasVisibility ? "true" : "false",
        promoApplied: promoApplied ? "true" : "false",
        promoKind: promoKind || "",
        planMinutes: String(product.timeLimitMinutes ?? 0),
      },
    });

    // 6. Return safe response — NO secret data
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      productId: product.id,
      productName: product.name,
    });
  } catch (error) {
    console.error("Create order error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "RAZORPAY_AUTH_FAILED") {
      return NextResponse.json(
        { error: "Payment service authentication failed" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
