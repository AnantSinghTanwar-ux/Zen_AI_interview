import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { applicantService } from "@/services/recruiter/applicant.service";
import { jobService } from "@/services/recruiter/job.service";
import { resumeScreeningService } from "@/services/recruiter/resume-screening.service";

/**
 * GET /api/v2/candidate/applications — Get all applications for the current user.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applications = await applicantService.getApplicationsByUser(user.id);

    // Enrich with job details and screening results
    const enriched = await Promise.all(
      applications.map(async (app) => {
        const [job, screening] = await Promise.all([
          jobService.getJob(app.jobId).catch(() => null),
          resumeScreeningService.getScreeningByApplicant(app.id).catch(() => null),
        ]);

        return {
          ...app,
          jobTitle: job?.title || "Unknown Position",
          companyName: job?.companyName || "Unknown Company",
          jobStatus: job?.status || "closed",
          screening: screening
            ? {
                overallScore: screening.overallScore,
                skillMatchPercent: screening.skillMatchPercent,
                recommendation: screening.recommendation,
                summary: screening.summary,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ applications: enriched });
  } catch (error) {
    console.error("[GET /api/v2/candidate/applications] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}
