import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { processPendingRecruiterScoreJobs } from "@/services/recruiter/recruiter-score-queue.service";
import { checkRateLimit } from "@/lib/services/rate-limit.service";

/**
 * POST /api/v2/recruiter/process-scores
 * Manually trigger processing of pending score jobs.
 * Scoring now also happens automatically right after an interview ends,
 * so this endpoint is a backstop for any jobs that might have been missed.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await recruiterGuard();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-write");
  if (!allowed) return response!;

  try {
    const result = await processPendingRecruiterScoreJobs(20);
    return NextResponse.json(
      {
        message: "Score processing triggered successfully",
        processed: result?.processed ?? 0,
        failed: result?.failed ?? 0,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Process scores error:", err);
    return NextResponse.json(
      { error: "Failed to process scores", details: (err as Error).message },
      { status: 500 }
    );
  }
}
