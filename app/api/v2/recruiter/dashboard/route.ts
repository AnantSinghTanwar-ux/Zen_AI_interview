import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { jobService } from "@/services/recruiter/job.service";
import { applicantService } from "@/services/recruiter/applicant.service";
import { screeningService } from "@/services/recruiter/screening.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recruiter = await recruiterService.getRecruiterByUserId(user.id);
    if (!recruiter) {
      return NextResponse.json(
        { error: "Recruiter profile not found" },
        { status: 403 }
      );
    }

    // Get all jobs for this recruiter
    const jobs = await jobService.listJobsByRecruiter(recruiter.id!);

    let totalApplicants = 0;
    const byStatus: Record<string, number> = {
      pending: 0,
      invited: 0,
      in_progress: 0,
      completed: 0,
      shortlisted: 0,
      rejected: 0,
    };
    let totalScore = 0;
    let scoredCount = 0;

    // Aggregate stats across all jobs
    for (const job of jobs) {
      const applicants = await applicantService.getApplicantsByJob(job.id);
      totalApplicants += applicants.length;

      for (const applicant of applicants) {
        byStatus[applicant.status] = (byStatus[applicant.status] || 0) + 1;

        if (applicant.status === "completed" || applicant.status === "shortlisted") {
          const result = await screeningService.getScreeningResults(applicant.id);
          if (result) {
            totalScore += result.overallScore;
            scoredCount++;
          }
        }
      }
    }

    const averageScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

    return NextResponse.json(
      {
        recruiter: {
          companyName: recruiter.companyName,
          industry: recruiter.industry,
          jobsCreated: recruiter.jobsCreated,
          applicantsScreened: recruiter.applicantsScreened,
        },
        totalJobs: jobs.length,
        totalApplicants,
        byStatus,
        averageScore,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
