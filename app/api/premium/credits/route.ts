import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { getUserCredits } from "@/lib/services/payment.service";
import { getCollegePlanForUser } from "@/lib/services/college.service";
import { db } from "@/services/firebase/admin";

/**
 * GET /api/premium/credits
 * Returns the current user's credits and any active college plan info.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get individual credits
    const credits = await getUserCredits(user.id);

    // Get user email for college plan check
    const userRef = db.collection("users").doc(user.id);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};
    const userEmail = userData.email || user.email || "";

    // Check college plan
    let collegePlan = null;
    if (userEmail) {
      const plan = await getCollegePlanForUser(userEmail);
      if (plan) {
        collegePlan = {
          collegeName: plan.collegeName,
          remaining: plan.totalInterviews - plan.usedInterviews,
          total: plan.totalInterviews,
          active: plan.active,
        };
      }
    }

    return NextResponse.json({
      credits,
      collegePlan,
      email: userEmail,
    });
  } catch (error) {
    console.error("Error fetching credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }
}
