import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { db } from "@/services/firebase/admin";
import { checkRateLimit } from "@/lib/services/rate-limit.service";

/**
 * GET /api/v2/feedback-jobs/[jobId] — Poll a single feedback job's status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "feedback-job-status");
    if (!allowed) return response!;

    const { jobId } = await params;
    const doc = await db.collection("feedback_jobs").doc(jobId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = doc.data()!;

    // Ensure the authenticated user owns this job
    if (job.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ id: doc.id, ...job }, { status: 200 });
  } catch (error) {
    console.error("[FeedbackJob] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback job" },
      { status: 500 }
    );
  }
}
