import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { applicantService } from "@/services/recruiter/applicant.service";
import { jobService } from "@/services/recruiter/job.service";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  failIdempotencyLock,
  IdempotencyToken,
} from "@/lib/services/idempotency.service";

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
    const { user, error } = await recruiterGuard();
    if (error) return error;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { allowed, response } = await checkRateLimit(request, user.id, "applicants-list");
    if (!allowed) return response!;

    const recruiter = await getOrCreateRecruiter(user.id);
    if (!recruiter) {
      return NextResponse.json([], { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const status = searchParams.get("status") || undefined;

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId query parameter is required" },
        { status: 400 }
      );
    }

    const job = await jobService.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.recruiterId !== recruiter.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const applicants = await applicantService.getApplicantsByJob(jobId, status);

    // Enrich applicants with screening results if completed
    const enriched = await Promise.all(
      applicants.map(async (a) => {
        if (a.status === "completed" || a.status === "shortlisted" || a.status === "rejected") {
          const full = await applicantService.getApplicantWithResults(a.id);
          return full || a;
        }
        return a;
      })
    );

    return NextResponse.json(enriched, { status: 200 });
  } catch (error) {
    console.error("Error listing applicants:", error);
    return NextResponse.json(
      { error: "Failed to list applicants" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  let idempotencyToken: IdempotencyToken | null = null;

  try {
    const { user, error } = await recruiterGuard();
    if (error) return error;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-write");
    if (!allowed) return response!;

    const idempotency = await acquireIdempotencyLock({
      request,
      userId: user.id,
      scope: "recruiter:applicants:update",
    });

    if (idempotency.state === "invalid") {
      return NextResponse.json({ error: idempotency.error }, { status: 400 });
    }

    if (idempotency.state === "in-progress") {
      return NextResponse.json(
        {
          error: "Idempotent request is already being processed",
          retryAfter: idempotency.retryAfterSeconds,
        },
        {
          status: 409,
          headers: {
            "Retry-After": String(idempotency.retryAfterSeconds),
          },
        }
      );
    }

    if (idempotency.state === "replay") {
      return NextResponse.json(idempotency.body, { status: idempotency.status });
    }

    if (idempotency.state === "acquired") {
      idempotencyToken = idempotency.token;
    }

    const data = await request.json();
    const { applicantId, status, notes } = data;

    if (!applicantId || !status) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "applicantId and status are required",
        });
      }
      return NextResponse.json(
        { error: "applicantId and status are required" },
        { status: 400 }
      );
    }

    const recruiter = await getOrCreateRecruiter(user.id);
    if (!recruiter) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "Recruiter profile not found",
        });
      }
      return NextResponse.json({ error: "Recruiter profile not found" }, { status: 403 });
    }

    const applicant = await applicantService.getApplicant(applicantId);
    if (!applicant) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "Applicant not found",
        });
      }
      return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
    }

    const job = await jobService.getJob(applicant.jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "Access denied",
        });
      }
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await applicantService.updateApplicantStatus(applicantId, status);

    if (notes) {
      await applicantService.addNote(applicantId, notes);
    }

    const payload = { success: true };

    if (idempotencyToken) {
      await completeIdempotencyLock({
        token: idempotencyToken,
        status: 200,
        body: payload,
      });
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("Error updating applicant:", error);

    if (idempotencyToken) {
      await failIdempotencyLock({
        token: idempotencyToken,
        error,
      });
    }

    return NextResponse.json(
      { error: "Failed to update applicant" },
      { status: 500 }
    );
  }
}
