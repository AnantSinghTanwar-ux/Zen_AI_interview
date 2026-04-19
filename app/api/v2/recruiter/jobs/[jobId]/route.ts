import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { jobService } from "@/services/recruiter/job.service";
import { applicantService } from "@/services/recruiter/applicant.service";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  failIdempotencyLock,
  IdempotencyToken,
} from "@/lib/services/idempotency.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-read");
    if (!allowed) return response!;

    const { jobId } = await params;
    const job = await jobService.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const applicants = await applicantService.getApplicantsByJob(jobId);

    return NextResponse.json({ job, applicants }, { status: 200 });
  } catch (error) {
    console.error("Error getting job details:", error);
    return NextResponse.json(
      { error: "Failed to get job details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  let idempotencyToken: IdempotencyToken | null = null;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-write");
    if (!allowed) return response!;

    const idempotency = await acquireIdempotencyLock({
      request,
      userId: user.id,
      scope: "recruiter:jobs:update",
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

    const { jobId } = await params;
    const data = await request.json();

    await jobService.updateJob(jobId, data);

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
    console.error("Error updating job:", error);

    if (idempotencyToken) {
      await failIdempotencyLock({
        token: idempotencyToken,
        error,
      });
    }

    return NextResponse.json(
      { error: "Failed to update job" },
      { status: 500 }
    );
  }
}
