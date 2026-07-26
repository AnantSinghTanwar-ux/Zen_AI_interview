import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { schedulingService } from "@/services/recruiter/scheduling.service";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { applicantService } from "@/services/recruiter/applicant.service";
import { jobService } from "@/services/recruiter/job.service";

/**
 * GET /api/v2/recruiter/schedule — List all scheduled interviews for this recruiter.
 * Supports: ?jobId= to filter by specific job.
 */
export async function GET(request: NextRequest) {
  const { user, error } = await recruiterGuard();
  if (error) return error;

  try {
    const recruiter = await recruiterService.getRecruiterByUserId(user!.id);
    if (!recruiter) {
      return NextResponse.json({ error: "Recruiter profile not found" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const jobId = searchParams.get("jobId");

    let schedules;
    if (jobId) {
      // Verify job ownership
      const job = await jobService.getJob(jobId);
      if (!job || job.recruiterId !== recruiter.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      schedules = await schedulingService.getSchedulesByJob(jobId);
    } else {
      schedules = await schedulingService.getSchedulesByRecruiter(recruiter.id!);
    }

    return NextResponse.json({ schedules });
  } catch (err) {
    console.error("[GET /api/v2/recruiter/schedule] Error:", err);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

/**
 * POST /api/v2/recruiter/schedule — Schedule an interview for a shortlisted candidate.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await recruiterGuard();
  if (error) return error;

  try {
    const recruiter = await recruiterService.getRecruiterByUserId(user!.id);
    if (!recruiter) {
      return NextResponse.json({ error: "Recruiter profile not found" }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    const { applicantId, jobId, scheduledAt, duration, interviewType, meetingLink, notes } = body;

    if (!applicantId || !jobId || !scheduledAt) {
      return NextResponse.json(
        { error: "applicantId, jobId, and scheduledAt are required" },
        { status: 400 }
      );
    }

    if (interviewType === "external" && !meetingLink?.trim()) {
      return NextResponse.json(
        { error: "meetingLink is required for external interviews" },
        { status: 400 }
      );
    }

    // Verify job ownership
    const job = await jobService.getJob(jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify applicant belongs to this job and is shortlisted
    const applicant = await applicantService.getApplicant(applicantId);
    if (!applicant || applicant.jobId !== jobId) {
      return NextResponse.json({ error: "Applicant not found for this job" }, { status: 404 });
    }

    if (applicant.status !== "shortlisted" && applicant.status !== "screened") {
      return NextResponse.json(
        { error: "Interviews can only be scheduled for shortlisted or screened candidates" },
        { status: 400 }
      );
    }

    const schedule = await schedulingService.scheduleInterview({
      jobId,
      applicantId,
      recruiterId: recruiter.id!,
      candidateUserId: applicant.candidateUserId,
      candidateName: applicant.name,
      candidateEmail: applicant.email,
      jobTitle: job.title,
      scheduledAt,
      duration: duration || 30,
      interviewType: interviewType || "ai",
      meetingLink: meetingLink || "",
      notes: notes || "",
    });

    // Update applicant status to invited
    await applicantService.updateApplicantStatus(applicantId, "invited");

    return NextResponse.json({ success: true, schedule }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to schedule interview";
    console.error("[POST /api/v2/recruiter/schedule] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
