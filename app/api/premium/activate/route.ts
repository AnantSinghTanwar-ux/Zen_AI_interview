import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import { grantPremiumAccess } from "@/lib/services/premium-access.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(
      request,
      user.id,
      "premium-activate"
    );
    if (!allowed) return response!;

    await grantPremiumAccess({ userId: user.id, source: "self-confirmed" });

    return NextResponse.json({
      success: true,
      isPremium: true,
      message: "Premium access enabled",
    });
  } catch (error) {
    console.error("Error activating premium:", error);
    return NextResponse.json(
      { error: "Failed to activate premium access" },
      { status: 500 }
    );
  }
}
