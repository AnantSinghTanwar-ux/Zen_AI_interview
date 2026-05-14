import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import {
  getUserCredits,
  consumeCredit,
  CreditType,
} from "@/lib/services/payment.service";
import { isSeedPremiumEmail } from "@/lib/services/premium-access.service";
import { db } from "@/services/firebase/admin";

/**
 * POST /api/premium/vapi-access
 *
 * Gate access to paid features (interviews & DSA practice).
 * If the user has paid credits → consume one and allow.
 * If the user is a seeded premium email → allow (no credit deduction).
 * Otherwise → return 402 requiring payment.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const feature = body.feature || "interview";
    const quotaKind = body.quotaKind || "interview";

    // Map feature to credit type
    const creditType: CreditType =
      feature === "dsa-practice" || quotaKind === "dsa"
        ? "dsaSessions"
        : "interviews";

    // Check if the user is a seeded premium email (founder/admin bypass)
    const userRef = db.collection("users").doc(user.id);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};
    const userEmail = userData.email || user.email || "";

    if (isSeedPremiumEmail(userEmail)) {
      return NextResponse.json({
        allowed: true,
        isPremium: true,
        reason: "seed-premium",
        trialConsumed: false,
        usageKey: "seed-access",
        dailyLimit: null,
      });
    }

    // Check user credits
    const credits = await getUserCredits(user.id);
    const available = credits[creditType];

    if (available <= 0) {
      return NextResponse.json(
        {
          allowed: false,
          code: "PAYMENT_REQUIRED",
          error: "No credits remaining",
          message:
            creditType === "dsaSessions"
              ? "You need to purchase a DSA Practice session to continue. Each session costs ₹99 for 30 minutes."
              : "You need to purchase an Interview session to continue. Each session costs ₹399 for 30 minutes.",
          credits,
          requiredProduct:
            creditType === "dsaSessions" ? "dsa_practice" : "single_interview",
        },
        { status: 402 }
      );
    }

    // Consume one credit
    const result = await consumeCredit({
      userId: user.id,
      creditType,
    });

    if (!result.allowed) {
      return NextResponse.json(
        {
          allowed: false,
          code: "PAYMENT_REQUIRED",
          error: "No credits remaining",
          message: "Purchase more credits to continue.",
          credits: await getUserCredits(user.id),
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      allowed: true,
      isPremium: true,
      reason: "paid-credits",
      trialConsumed: false,
      usageKey: `credit-${creditType}-${Date.now()}`,
      remaining: result.remaining,
      dailyLimit: null,
    });
  } catch (error) {
    console.error("Error checking Vapi access:", error);
    return NextResponse.json(
      { error: "Failed to validate access" },
      { status: 500 }
    );
  }
}
