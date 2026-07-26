import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { jobService } from "@/services/recruiter/job.service";
import { applicantService } from "@/services/recruiter/applicant.service";
import { resumeScreeningService } from "@/services/recruiter/resume-screening.service";
import { notificationService } from "@/services/recruiter/notification.service";

/**
 * POST /api/v2/jobs/[jobId]/apply — Authenticated endpoint: apply for a job.
 * Accepts JSON body with resumeText and optional coverLetter.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    // Validate job exists and is active
    const job = await jobService.getJob(jobId);
    if (!job || job.status !== "active") {
      return NextResponse.json(
        { error: "This job posting is no longer accepting applications" },
        { status: 404 }
      );
    }

    // Check deadline
    if (job.deadline && new Date(job.deadline).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "The application deadline for this job has passed" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const resumeText = typeof body.resumeText === "string" ? body.resumeText.trim() : "";
    const coverLetter = typeof body.coverLetter === "string" ? body.coverLetter.trim() : "";

    if (!resumeText || resumeText.length < 50) {
      return NextResponse.json(
        { error: "Please upload a valid resume (minimum 50 characters of extractable text)" },
        { status: 400 }
      );
    }

    // Create applicant record
    const { applicantId, isDuplicate } = await applicantService.applyForJob({
      jobId,
      name: user.name || user.email.split("@")[0],
      email: user.email,
      resumeText,
      coverLetter,
      candidateUserId: user.id,
    });

    if (isDuplicate) {
      return NextResponse.json(
        { error: "You have already applied for this job" },
        { status: 409 }
      );
    }

    if (!applicantId) {
      return NextResponse.json(
        { error: "Failed to submit application" },
        { status: 500 }
      );
    }

    // Update applicant status to "screening"
    await applicantService.updateApplicantStatus(applicantId, "screening");

    // Trigger AI resume screening asynchronously (don't block the response)
    resumeScreeningService
      .screenResume({
        applicantId,
        jobId,
        resumeText,
        job,
      })
      .then(async (result) => {
        // Update applicant with screening result
        await applicantService.updateApplicantStatus(applicantId, "screened", {
          screeningResultId: result.id,
        });

        // Notify candidate
        await notificationService.notifyScreeningComplete({
          candidateUserId: user.id,
          jobTitle: job.title,
          recommendation: result.recommendation,
          jobId,
          applicantId,
        });
      })
      .catch((err) => {
        console.error(
          `[Apply API] AI screening failed for applicant ${applicantId}:`,
          err
        );
        // Revert to pending if screening fails — applicant is still applied
        applicantService
          .updateApplicantStatus(applicantId, "pending")
          .catch(console.error);
      });

    return NextResponse.json(
      {
        success: true,
        applicantId,
        message: "Application submitted successfully. Your resume is being reviewed by our AI system.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/v2/jobs/[jobId]/apply] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
