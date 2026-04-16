import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { jobService } from "@/services/recruiter/job.service";
import { applicantService } from "@/services/recruiter/applicant.service";
import { screeningService } from "@/services/recruiter/screening.service";

async function getOrCreateRecruiter(userId: string) {
  let recruiter = await recruiterService.getRecruiterByUserId(userId);
  if (!recruiter) {
    const id = await recruiterService.createRecruiterProfile({
      userId,
      companyName: "My Company",
      industry: "Technology",
      role: "recruiter",
      jobsCreated: 0,
      applicantsScreened: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    recruiter = await recruiterService.getRecruiter(id);
  }
  return recruiter;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recruiter = await getOrCreateRecruiter(user.id);
    if (!recruiter) {
      return NextResponse.json(
        { totalJobs: 0, totalApplicants: 0, byStatus: {}, averageScore: 0 },
        { status: 200 }
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
      try {
        const applicants = await applicantService.getApplicantsByJob(job.id);
        totalApplicants += applicants.length;

        for (const applicant of applicants) {
          if (byStatus[applicant.status] !== undefined) {
            byStatus[applicant.status]++;
          }

          if (applicant.status === "completed" || applicant.status === "shortlisted") {
            try {
              const result = await screeningService.getScreeningResults(applicant.id);
              if (result) {
                totalScore += result.overallScore;
                scoredCount++;
              }
            } catch {
              // Skip if result fetch fails
            }
          }
        }
      } catch {
        // Skip if this job's applicants fail to load
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
      { error: "Failed to fetch dashboard data", details: (error as Error).message },
      { status: 500 }
    );
  }
}
