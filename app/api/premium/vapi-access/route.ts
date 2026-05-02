import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";

// Premium system removed — all authenticated users get full access.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      allowed: true,
      isPremium: true,
      reason: "premium",
      trialConsumed: false,
      usageKey: "all-access",
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
