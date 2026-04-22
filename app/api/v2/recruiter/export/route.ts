import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { applicantService } from "@/services/recruiter/applicant.service";
import { screeningService } from "@/services/recruiter/screening.service";
import { jobService } from "@/services/recruiter/job.service";
import { checkRateLimit } from "@/lib/services/rate-limit.service";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await recruiterGuard();
    if (error) return error;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-read");
    if (!allowed) return response!;

    const recruiter = await recruiterService.getRecruiterByUserId(user.id);
    if (!recruiter) {
      return NextResponse.json(
        { error: "Recruiter profile not found" },
        { status: 403 }
      );
    }

    const data = await request.json();
    const { jobId } = data;

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    const job = await jobService.getJob(jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get shortlisted applicants
    const applicants = await applicantService.getApplicantsByJob(jobId, "shortlisted");

    if (applicants.length === 0) {
      return NextResponse.json(
        { error: "No shortlisted applicants to export" },
        { status: 400 }
      );
    }

    // Build CSV with results
    const rows = ["Name,Email,Status,Overall Score,Technical,Communication,Problem Solving,Recommendation,Resume URL"];

    for (const applicant of applicants) {
      const result = await screeningService.getScreeningResults(applicant.id);
      rows.push(
        [
          `"${applicant.name}"`,
          applicant.email,
          applicant.status,
          result?.overallScore ?? "N/A",
          result?.technicalScore ?? "N/A",
          result?.communicationScore ?? "N/A",
          result?.problemSolvingScore ?? "N/A",
          result?.recommendation ?? "N/A",
          applicant.resumeUrl || "",
        ].join(",")
      );
    }

    const csvContent = rows.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="shortlisted_${jobId}_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting:", error);
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500 }
    );
  }
}
