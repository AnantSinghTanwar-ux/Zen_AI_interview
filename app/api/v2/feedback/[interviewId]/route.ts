import { NextRequest, NextResponse } from "next/server";
import { feedbackService } from "@/services/feedback/feedback.service";
import { getCurrentUser } from "@/lib/actions/auth.actions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ interviewId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interviewId } = await params;
    const feedback = await feedbackService.getFeedbackByInterview(interviewId);
    
    if (!feedback) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    return NextResponse.json(feedback, { status: 200 });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ interviewId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interviewId } = await params;
    const data = await request.json();
    
    const feedbackData = {
      userId: user.id,
      interviewId,
      ...data,
    };

    const feedbackId = await feedbackService.createFeedback(feedbackData);
    
    return NextResponse.json({ id: feedbackId }, { status: 201 });
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    );
  }
}
