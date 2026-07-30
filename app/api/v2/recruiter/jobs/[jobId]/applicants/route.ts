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

    // Fetch bulk candidates
    const { db } = await import("@/services/firebase/admin");
    const bulkSnapshot = await db.collection("bulk_candidates").where("jobId", "==", jobId).get();
    const existingEmails = new Set(applicants.map(a => a.email));

    for (const doc of bulkSnapshot.docs) {
      const data = doc.data();
      if (!data.email || existingEmails.has(data.email)) continue;
      
      if (statusFilter && statusFilter !== (data.isShortlisted ? "shortlisted" : "pending")) continue;

      applicants.push({
        id: doc.id,
        jobId: data.jobId,
        name: data.name || data.fileName || "Candidate",
        email: data.email,
        resumeText: data.resumeText || "",
        status: data.isShortlisted ? "shortlisted" : "pending",
        appliedAt: data.createdAt || new Date().toISOString(),
        interviewScore: data.interviewScore || null,
        interviewRecommendation: data.interviewFeedback || null,
      } as any);
      existingEmails.add(data.email);
    }

    // Fetch screening results for all applicants
    const screeningResults = await resumeScreeningService.getScreeningsByJob(jobId);
    const screeningMap = new Map<string, ResumeScreeningResult>();
    for (const s of screeningResults) {
      if (!screeningMap.has(s.applicantId)) {
        screeningMap.set(s.applicantId, s);
      }
    }

    // Also enrich the bulk candidates with their own screening data directly from their doc
    const bulkScreeningMap = new Map<string, any>();
    for (const doc of bulkSnapshot.docs) {
      const data = doc.data();
      bulkScreeningMap.set(doc.id, {
        id: doc.id,
        applicantId: doc.id,
        jobId: data.jobId,
        overallScore: data.llmScore || data.semanticScore || 0,
        recommendation: data.recommendation || "pending",
        assessmentSummary: data.assessmentSummary || "",
        skillMatchPercent: data.skillMatchPercent || 0,
        matchedSkills: data.matchedSkills || [],
        missingSkills: data.missingSkills || [],
        createdAt: data.createdAt || new Date().toISOString(),
        isReviewed: true
      });
    }

    // Enrich applicants with screening data
    let enriched = applicants.map((a) => ({
      ...a,
      screening: screeningMap.get(a.id) || bulkScreeningMap.get(a.id) || null,
    }));

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
      enriched.sort(
        (a, b) => (b.screening?.overallScore || 0) - (a.screening?.overallScore || 0)
      );
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
