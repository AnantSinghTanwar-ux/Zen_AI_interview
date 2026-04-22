import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import {
  getApplications,
  getDistinctValues,
  updateApplicationScoreState,
} from "@/services/recruiter/external-application.service";
import {
  getLeaderboard,
  getScoreByApplication,
} from "@/services/recruiter/application-score.service";
import type { ExternalApplication } from "@/types/external-application";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  enqueueRecruiterScoreBackfillJobs,
  processPendingRecruiterScoreJobs,
} from "@/services/recruiter/recruiter-score-queue.service";

async function backfillScoresForCompletedApps(apps: ExternalApplication[]) {
  const candidates = apps.filter((a) => a.interviewStatus === "completed" && Boolean(a.interviewId));
  if (candidates.length === 0) return;

  // Normalize any apps that already have a score but outdated status metadata.
  for (const app of candidates.slice(0, 20)) {
    const existingScore = await getScoreByApplication(app.id);
    if (
      existingScore &&
      (app.scoreStatus !== "available" || app.scoreId !== existingScore.id)
    ) {
      await updateApplicationScoreState(app.id, {
        scoreStatus: "available",
        scoreId: existingScore.id,
      });
    }
  }

  // Enqueue pending items instead of scoring synchronously on dashboard requests.
  await enqueueRecruiterScoreBackfillJobs(candidates);
}

export async function GET(request: NextRequest) {
  const { user, error } = await recruiterGuard();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-read");
  if (!allowed) return response!;

  try {
    const allApps = await getApplications();

    // Fix missing scores so the dashboard + leaderboard populate.
    await backfillScoresForCompletedApps(allApps);
    await processPendingRecruiterScoreJobs(5).catch((queueError) => {
      console.error("[RecruiterDashboard] Failed to process pending score jobs", queueError);
    });

    const filterOptions = await getDistinctValues();
    const topCandidates = await getLeaderboard();

    const totalApplications = allApps.length;
    const completedInterviews = allApps.filter((a) => a.interviewStatus === "completed").length;
    const pendingInterviews = allApps.filter((a) => a.interviewStatus === "pending").length;
    const invitedInterviews = allApps.filter((a) => a.interviewStatus === "invited").length;

    // By role
    const byRole: Record<string, number> = {};
    const byCompany: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    allApps.forEach((a) => {
      byRole[a.roleCategory] = (byRole[a.roleCategory] || 0) + 1;
      byCompany[a.companyName] = (byCompany[a.companyName] || 0) + 1;
      bySource[a.sourcePlatform] = (bySource[a.sourcePlatform] || 0) + 1;
    });

    // Average score from leaderboard
    const scoredEntries = topCandidates.filter((c) => c.overallScore > 0);
    const averageScore =
      scoredEntries.length > 0
        ? Math.round(scoredEntries.reduce((s, c) => s + c.overallScore, 0) / scoredEntries.length)
        : 0;

    return NextResponse.json(
      {
        totalApplications,
        completedInterviews,
        pendingInterviews,
        invitedInterviews,
        averageScore,
        byRole,
        byCompany,
        bySource,
        topCandidates: topCandidates.slice(0, 5),
        filterOptions,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Failed", details: (err as Error).message }, { status: 500 });
  }
}
