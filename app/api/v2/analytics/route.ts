import { NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/services/analytics/analytics.service";
import { getCurrentUser } from "@/lib/actions/auth.actions";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const analytics = await analyticsService.getUserAnalytics(user.id, days);
    
    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    
    const performanceData = {
      userId: user.id,
      interviewId: data.interviewId,
      interviewType: data.interviewType,
      score: data.score,
      completionRate: data.completionRate,
      duration: data.duration,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      feedback: data.feedback,
      createdAt: new Date(),
    };

    const id = await analyticsService.recordPerformance(performanceData);
    
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Error recording performance:", error);
    return NextResponse.json(
      { error: "Failed to record performance" },
      { status: 500 }
    );
  }
}
