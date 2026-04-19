import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { screeningService } from "@/services/recruiter/screening.service";
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
