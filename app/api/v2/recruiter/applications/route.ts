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

    let applications: Awaited<ReturnType<typeof getApplications>> = [];
    try {
      applications = await getApplications({
        roleCategory,
        companyName,
        sourcePlatform,
        roleTitle,
        status,
        interviewStatus,
      });
    } catch (fbErr) {
      console.error("[Applications] Firebase error:", (fbErr as Error).message);
      return NextResponse.json(
        { applications: [], total: 0, _warning: "Data temporarily unavailable. Firebase quota may be exceeded." },
        { status: 200 }
      );
    }

    // Enrich with scores where available
    const enriched = await Promise.all(
      applications.map(async (app) => {
        if (app.scoreStatus === "available") {
          try {
            const score = await getScoreByApplication(app.id);
            return {
              ...app,
              score: score ? normalizeRecruiterScoreForDisplay(score) : null,
            };
          } catch {
            return { ...app, score: null };
          }
        }
        return { ...app, score: null };
      })
    );

    const responseBody: any = { applications: enriched, total: enriched.length };

    // Optionally include filter options for the UI
    if (includeFilters) {
      try {
        responseBody.filterOptions = await getDistinctValues();
      } catch {
        responseBody.filterOptions = { roleCategories: [], companies: [], sources: [] };
      }
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (err) {
    console.error("Applications list error:", err);
    return NextResponse.json({ error: "Failed", details: (err as Error).message }, { status: 500 });
  }
}
