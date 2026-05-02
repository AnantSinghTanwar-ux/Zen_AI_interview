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
    // Fetch applications — return empty state if Firebase is unavailable
    let allApps: ExternalApplication[] = [];
    try {
      allApps = await getApplications();
    } catch (fbErr) {
      console.error("[RecruiterDashboard] Firebase getApplications failed:", (fbErr as Error).message);
      // Return a graceful empty dashboard rather than 500
      return NextResponse.json(
        {
          totalApplications: 0,
          completedInterviews: 0,
          pendingInterviews: 0,
          invitedInterviews: 0,
          averageScore: 0,
          byRole: {},
          byCompany: {},
          bySource: {},
          topCandidates: [],
          filterOptions: { roleCategories: [], companies: [], sources: [] },
          _warning: "Data temporarily unavailable. Firebase quota may be exceeded — please upgrade to Blaze plan.",
        },
        { status: 200 }
      );
    }

    // Fire-and-forget: backfill + queue processing in background.
    // This avoids blocking the dashboard response while AI scores generate.
    Promise.resolve()
      .then(() => backfillScoresForCompletedApps(allApps))
      .then(() => processPendingRecruiterScoreJobs(3))
      .catch((bgErr) => {
        console.error("[RecruiterDashboard] Background scoring error (non-blocking):", bgErr);
      });

    let filterOptions = { roleCategories: [] as string[], companies: [] as string[], sources: [] as string[] };
    let topCandidates: Awaited<ReturnType<typeof getLeaderboard>> = [];

    try {
      [filterOptions, topCandidates] = await Promise.all([
        getDistinctValues(),
        getLeaderboard(),
      ]);
    } catch (fbErr) {
      console.error("[RecruiterDashboard] Firebase secondary fetch failed:", (fbErr as Error).message);
      // Continue with empty values — don't 500
    }

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
