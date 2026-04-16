import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { getApplications, getDistinctValues } from "@/services/recruiter/external-application.service";
import { getLeaderboard } from "@/services/recruiter/application-score.service";

export async function GET(request: NextRequest) {
  const { error } = await recruiterGuard();
  if (error) return error;

  try {
    const allApps = await getApplications();
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
