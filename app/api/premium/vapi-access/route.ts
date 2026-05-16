import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import {
  getUserCredits,
  consumeCredit,
  CreditType,
  getProductById,
  createPremiumSession,
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
    const action = body.action || "consume"; // "check" | "consume"
    const requestedPlanId = typeof body.planId === "string" ? body.planId : undefined;

    const isDsa = feature === "dsa-practice" || quotaKind === "dsa";
    const planId = isDsa ? "dsa_practice" : (requestedPlanId || "interview_30");
    const product = getProductById(planId);

    if (!isDsa && (!product || (product.creditType !== "interviews10" && product.creditType !== "interviews30" && product.creditType !== "interviews"))) {
      return NextResponse.json(
        { error: "Invalid interview plan" },
        { status: 400 }
      );
    }

    const creditType: CreditType = isDsa
      ? "dsaSessions"
      : (product?.creditType === "interviews" ? "interviews30" : (product?.creditType as CreditType));

    const timeLimitMinutes = isDsa ? 30 : (product?.timeLimitMinutes || 30);
    const messageLimit = isDsa ? 60 : null;

    // Get user email from Firestore
    const userRef = db.collection("users").doc(user.id);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};
    const userEmail = userData.email || user.email || "";

    // ─── Priority 1: Seed premium bypass ────────────────────────────
    if (isSeedPremiumEmail(userEmail)) {
      if (action === "check") {
        return NextResponse.json({
          allowed: true,
          isPremium: true,
          reason: "seed-premium",
          trialConsumed: false,
          remaining: null,
          dailyLimit: null,
          timeLimitMinutes,
        });
      }

      const session = await createPremiumSession({
        userId: user.id,
        feature: isDsa ? "dsa-practice" : "interview",
        planId,
        timeLimitMinutes,
        messageLimit,
      });

      return NextResponse.json({
        allowed: true,
        isPremium: true,
        reason: "seed-premium",
        trialConsumed: false,
        usageKey: session.id,
        expiresAtMs: session.expiresAtMs,
        timeLimitMinutes,
        messageLimit,
        dailyLimit: null,
      });
    }

    // ─── Priority 2: Individual paid credits ────────────────────────
    const credits = await getUserCredits(user.id);
    const available = (credits as any)[creditType] ?? 0;

    if (available > 0) {
      if (action === "check") {
        return NextResponse.json({
          allowed: true,
          isPremium: true,
          reason: "paid-credits",
          trialConsumed: false,
          remaining: available,
          dailyLimit: null,
          timeLimitMinutes,
        });
      }

      const result = await consumeCredit({
        userId: user.id,
        creditType,
      });

      if (result.allowed) {
        const session = await createPremiumSession({
          userId: user.id,
          feature: isDsa ? "dsa-practice" : "interview",
          planId,
          timeLimitMinutes,
          messageLimit,
        });

        return NextResponse.json({
          allowed: true,
          isPremium: true,
          reason: "paid-credits",
          trialConsumed: false,
          usageKey: session.id,
          expiresAtMs: session.expiresAtMs,
          timeLimitMinutes,
          messageLimit,
          remaining: result.remaining,
          dailyLimit: null,
        });
      }
    }

    // ─── Priority 3: College plan (interviews only) ─────────────────
    if (!isDsa && creditType !== "interviews10" && userEmail) {
      const collegePlan = await getCollegePlanForUser(userEmail);

      if (collegePlan) {
        if (action === "check") {
          return NextResponse.json({
            allowed: true,
            isPremium: true,
            reason: "college-plan",
            collegeName: collegePlan.collegeName,
            trialConsumed: false,
            remaining: collegePlan.totalInterviews - collegePlan.usedInterviews,
            dailyLimit: null,
            timeLimitMinutes,
          });
        }

        const collegeResult = await consumeCollegeInterview({
          userEmail,
          userId: user.id,
        });

        if (collegeResult.allowed) {
          const session = await createPremiumSession({
            userId: user.id,
            feature: "interview",
            planId,
            timeLimitMinutes,
            messageLimit,
          });

          return NextResponse.json({
            allowed: true,
            isPremium: true,
            reason: "college-plan",
            collegeName: collegeResult.collegeName,
            trialConsumed: false,
            usageKey: session.id,
            expiresAtMs: session.expiresAtMs,
            timeLimitMinutes,
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
            requiredProduct: "interview_30",
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
          isDsa
            ? "You need to purchase a DSA Practice session to continue. Pricing starts at ₹19 for 30 minutes."
            : "You need to purchase an Interview session to continue. Choose 10 min (₹149) or 30 min (₹399).",
        credits,
        requiredProduct: isDsa ? "dsa_practice" : planId,
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
