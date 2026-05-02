import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";

// Premium system removed — all authenticated users have full access.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      isPremium: true,
      message: "All users have full access",
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed" },
      { status: 500 }
    );
  }
}
