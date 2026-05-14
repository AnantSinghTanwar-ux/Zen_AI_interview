import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import {
  getUserCredits,
  consumeCredit,
  CreditType,
} from "@/lib/services/payment.service";
import { isSeedPremiumEmail } from "@/lib/services/premium-access.service";
import {
  getCollegePlanForUser,
  consumeCollegeInterview,
} from "@/lib/services/college.service";
import { db } from "@/services/firebase/admin";

/**
 * POST /api/premium/vapi-access
 *
 * Gate access to paid features (interviews & DSA practice).
 * Priority:
 *   1. Seed premium emails → always allowed (no deduction)
 *   2. Individual paid credits → consume one credit
 *   3. College plan (matching email domain) → consume from college pool (interviews only)
 *   4. No access → 402 requiring payment
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

    // Get user email from Firestore
    const userRef = db.collection("users").doc(user.id);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};
    const userEmail = userData.email || user.email || "";

    // ─── Priority 1: Seed premium bypass ────────────────────────────
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

    // ─── Priority 2: Individual paid credits ────────────────────────
    const credits = await getUserCredits(user.id);
    const available = credits[creditType];

    if (available > 0) {
      const result = await consumeCredit({
        userId: user.id,
        creditType,
      });

      if (result.allowed) {
        return NextResponse.json({
          allowed: true,
          isPremium: true,
          reason: "paid-credits",
          trialConsumed: false,
          usageKey: `credit-${creditType}-${Date.now()}`,
          remaining: result.remaining,
          dailyLimit: null,
        });
      }
    }

    // ─── Priority 3: College plan (interviews only) ─────────────────
    if (creditType === "interviews" && userEmail) {
      const collegePlan = await getCollegePlanForUser(userEmail);

      if (collegePlan) {
        const collegeResult = await consumeCollegeInterview({
          userEmail,
          userId: user.id,
        });

        if (collegeResult.allowed) {
          return NextResponse.json({
            allowed: true,
            isPremium: true,
            reason: "college-plan",
            collegeName: collegeResult.collegeName,
            trialConsumed: false,
            usageKey: `college-${collegePlan.emailDomain}-${Date.now()}`,
            remaining: collegeResult.remaining,
            dailyLimit: null,
          });
        }

        // College plan exists but exhausted
        return NextResponse.json(
          {
            allowed: false,
            code: "COLLEGE_QUOTA_EXHAUSTED",
            error: "College interview quota exhausted",
            message: `Your college (${collegeResult.collegeName}) has used all purchased interview sessions. Contact your placement cell for more or purchase individually.`,
            credits,
            requiredProduct: "single_interview",
          },
          { status: 402 }
        );
      }
    }

    // ─── No access available ────────────────────────────────────────
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
  } catch (error) {
    console.error("Error checking Vapi access:", error);
    return NextResponse.json(
      { error: "Failed to validate access" },
      { status: 500 }
    );
  }
}
