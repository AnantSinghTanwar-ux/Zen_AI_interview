import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { screeningService } from "@/services/recruiter/screening.service";
import { jobService } from "@/services/recruiter/job.service";
import { applicantService } from "@/services/recruiter/applicant.service";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  failIdempotencyLock,
  IdempotencyToken,
} from "@/lib/services/idempotency.service";

export async function POST(request: NextRequest) {
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
      scope: "recruiter:screening:assign",
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

    const recruiter = await recruiterService.getRecruiterByUserId(user.id);
    if (!recruiter) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "Recruiter profile not found",
        });
      }
      return NextResponse.json(
        { error: "Recruiter profile not found" },
        { status: 403 }
      );
    }

    const data = await request.json();
    const { jobId, applicantIds } = data;

    if (!jobId || !applicantIds?.length) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "jobId and applicantIds are required",
        });
      }
      return NextResponse.json(
        { error: "jobId and applicantIds are required" },
        { status: 400 }
      );
    }

    const job = await jobService.getJob(jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      if (idempotencyToken) {
        await failIdempotencyLock({ token: idempotencyToken, error: "Access denied" });
      }
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    for (const applicantId of applicantIds) {
      const applicant = await applicantService.getApplicant(String(applicantId));
      if (!applicant || applicant.jobId !== jobId) {
        if (idempotencyToken) {
          await failIdempotencyLock({ token: idempotencyToken, error: `Invalid applicant: ${applicantId}` });
        }
        return NextResponse.json({ error: `Invalid applicant for job: ${applicantId}` }, { status: 400 });
      }
    }

    const result = await screeningService.assignInterviewsToApplicants(
      jobId,
      applicantIds
    );

    if (idempotencyToken) {
      await completeIdempotencyLock({
        token: idempotencyToken,
        status: 200,
        body: result,
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error assigning screenings:", error);

    if (idempotencyToken) {
      await failIdempotencyLock({
        token: idempotencyToken,
        error,
      });
    }

    return NextResponse.json(
      { error: "Failed to assign screenings" },
      { status: 500 }
    );
  }
}
