import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { jobService } from "@/services/recruiter/job.service";
import { applicantService } from "@/services/recruiter/applicant.service";
import { resumeScreeningService } from "@/services/recruiter/resume-screening.service";
import { notificationService } from "@/services/recruiter/notification.service";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import type { ResumeScreeningResult } from "@/types/recruiter";

/**
 * GET /api/v2/recruiter/jobs/[jobId]/applicants — List applicants with AI screening data.
 * Supports: ?status=, ?search=, ?sort=score|date|name
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { user, error } = await recruiterGuard();
  if (error) return error;

  try {
    const { jobId } = await params;
    const { searchParams } = request.nextUrl;

    // Verify job ownership
    const recruiter = await recruiterService.getRecruiterByUserId(user!.id);
    if (!recruiter) {
      return NextResponse.json({ error: "Recruiter profile not found" }, { status: 403 });
    }

    const job = await jobService.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.recruiterId !== recruiter.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const statusFilter = searchParams.get("status") || undefined;
    let applicants = await applicantService.getApplicantsByJob(jobId, statusFilter);

    // Fetch screening results for all applicants
    const screeningResults = await resumeScreeningService.getScreeningsByJob(jobId);
    const screeningMap = new Map<string, ResumeScreeningResult>();
    for (const s of screeningResults) {
      if (!screeningMap.has(s.applicantId)) {
        screeningMap.set(s.applicantId, s);
      }
    }

    // Enrich applicants with screening data
    let enriched = applicants.map((a) => ({
      ...a,
      screening: screeningMap.get(a.id) || null,
    }));

    // Fetch Bulk Candidates and merge them
    const { db } = await import("@/services/firebase/admin");
    const { COLLECTION_BULK_CANDIDATES } = await import("@/constants/screening.config");
    const bulkSnapshot = await db.collection(COLLECTION_BULK_CANDIDATES).where("jobId", "==", jobId).get();
    
    const bulkApplicants = bulkSnapshot.docs.map(doc => {
      const data = doc.data();
      let status = "screened";
      if (data.interviewScore !== undefined && data.interviewScore !== null) {
        status = "completed";
      } else if (data.emailSentAt) {
        status = "invited";
      } else if (data.isShortlisted) {
        status = "shortlisted";
      }

      return {
        id: doc.id,
        jobId: jobId,
        name: data.name || data.fileName || "Unknown",
        email: data.email || "",
        status: status,
        appliedAt: data.createdAt || new Date().toISOString(),
        interviewScore: data.interviewScore || null,
        interviewRecommendation: data.interviewRecommendation || null,
        notes: data.interviewFeedback || null,
        screening: {
          overallScore: data.llmScore || data.semanticScore || 0,
          skillMatchPercent: data.skillMatchPercent || 0,
          matchedSkills: data.matchedSkills || [],
          missingSkills: data.missingSkills || [],
          recommendation: data.recommendation || "review",
          summary: data.assessmentSummary || "",
        }
      };
    });

    enriched = [...enriched, ...bulkApplicants as any];

    // Filter by status if needed
    if (statusFilter) {
      enriched = enriched.filter(a => a.status === statusFilter);
    }

    // Search filter
    const search = searchParams.get("search")?.toLowerCase().trim();
    if (search) {
      enriched = enriched.filter(
        (a) =>
          a.name.toLowerCase().includes(search) ||
          a.email.toLowerCase().includes(search)
      );
    }

    // Sort
    const sort = searchParams.get("sort");
    if (sort === "score") {
      enriched.sort((a, b) => {
        // Prioritize interview score, fallback to screening score
        const scoreA = (a as any).interviewScore ?? a.screening?.overallScore ?? 0;
        const scoreB = (b as any).interviewScore ?? b.screening?.overallScore ?? 0;
        return scoreB - scoreA;
      });
    } else if (sort === "name") {
      enriched.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Default: by appliedAt desc (already sorted by the service)

    return NextResponse.json({
      applicants: enriched,
      total: enriched.length,
      job: { id: job.id, title: job.title, status: job.status },
    });
  } catch (err) {
    console.error("[GET /api/v2/recruiter/jobs/[jobId]/applicants] Error:", err);
    return NextResponse.json({ error: "Failed to fetch applicants" }, { status: 500 });
  }
}

/**
 * PATCH /api/v2/recruiter/jobs/[jobId]/applicants — Update applicant status.
 * Body: { applicantId, status, notes? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { user, error } = await recruiterGuard();
  if (error) return error;

  try {
    const { jobId } = await params;
    const body = await request.json();

    const { applicantId, status, notes } = body;
    if (!applicantId || !status) {
      return NextResponse.json(
        { error: "applicantId and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = [
      "pending", "screening", "screened", "invited",
      "in_progress", "completed", "rejected", "shortlisted",
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Verify job ownership
    const recruiter = await recruiterService.getRecruiterByUserId(user!.id);
    if (!recruiter) {
      return NextResponse.json({ error: "Recruiter profile not found" }, { status: 403 });
    }

    const job = await jobService.getJob(jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify applicant belongs to this job
    const applicant = await applicantService.getApplicant(applicantId);
    if (!applicant || applicant.jobId !== jobId) {
      return NextResponse.json({ error: "Applicant not found for this job" }, { status: 404 });
    }

    await applicantService.updateApplicantStatus(applicantId, status);

    if (typeof notes === "string") {
      await applicantService.addNote(applicantId, notes);
    }

    // Send notification to candidate
    if (applicant.candidateUserId) {
      notificationService
        .notifyStatusChange({
          candidateUserId: applicant.candidateUserId,
          jobTitle: job.title,
          newStatus: status,
          jobId,
          applicantId,
        })
        .catch((err) =>
          console.error("[Applicants PATCH] Notification failed:", err)
        );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/v2/recruiter/jobs/[jobId]/applicants] Error:", err);
    return NextResponse.json({ error: "Failed to update applicant" }, { status: 500 });
  }
}
