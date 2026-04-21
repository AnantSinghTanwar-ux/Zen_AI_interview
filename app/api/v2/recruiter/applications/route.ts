import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { getApplications, getDistinctValues } from "@/services/recruiter/external-application.service";
import {
  getScoreByApplication,
  normalizeRecruiterScoreForDisplay,
} from "@/services/recruiter/application-score.service";
import { checkRateLimit } from "@/lib/services/rate-limit.service";

export async function GET(request: NextRequest) {
  const { user, error } = await recruiterGuard();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-read");
  if (!allowed) return response!;

  try {
    const { searchParams } = new URL(request.url);
    const roleCategory = searchParams.get("roleCategory") || undefined;
    const companyName = searchParams.get("companyName") || undefined;
    const sourcePlatform = searchParams.get("sourcePlatform") || undefined;
    const roleTitle = searchParams.get("roleTitle") || undefined;
    const status = searchParams.get("status") || undefined;
    const interviewStatus = searchParams.get("interviewStatus") || undefined;
    const includeFilters = searchParams.get("includeFilters") === "true";

    const applications = await getApplications({
      roleCategory,
      companyName,
      sourcePlatform,
      roleTitle,
      status,
      interviewStatus,
    });

    // Enrich with scores where available
    const enriched = await Promise.all(
      applications.map(async (app) => {
        if (app.scoreStatus === "available") {
          const score = await getScoreByApplication(app.id);
          return {
            ...app,
            score: score ? normalizeRecruiterScoreForDisplay(score) : null,
          };
        }
        return { ...app, score: null };
      })
    );

    const response: any = { applications: enriched, total: enriched.length };

    // Optionally include filter options for the UI
    if (includeFilters) {
      response.filterOptions = await getDistinctValues();
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("Applications list error:", err);
    return NextResponse.json({ error: "Failed", details: (err as Error).message }, { status: 500 });
  }
}
