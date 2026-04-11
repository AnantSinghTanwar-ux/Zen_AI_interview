import { NextRequest, NextResponse } from "next/server";
import { gamificationService } from "@/services/gamification/gamification.service";
import { getCurrentUser } from "@/lib/actions/auth.actions";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const progress = await gamificationService.getUserProgress(user.id);
    
    if (!progress) {
      const initialProgress = await gamificationService.initializeUserProgress(user.id);
      return NextResponse.json(initialProgress, { status: 200 });
    }

    return NextResponse.json(progress, { status: 200 });
  } catch (error) {
    console.error("Error fetching progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
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
    
    const result = await gamificationService.updateProgress(user.id, {
      score: data.score,
      duration: data.duration,
      interviewType: data.interviewType,
      completed: data.completed,
    });
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error updating progress:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }
}
