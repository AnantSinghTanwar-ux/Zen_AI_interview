import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { updateApplicationStatus } from "@/services/recruiter/external-application.service";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  failIdempotencyLock,
  IdempotencyToken,
} from "@/lib/services/idempotency.service";

export async function PATCH(request: NextRequest) {
  let idempotencyToken: IdempotencyToken | null = null;

  const { user, error } = await recruiterGuard();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-write");
  if (!allowed) return response!;

  try {
    const idempotency = await acquireIdempotencyLock({
      request,
      userId: user.id,
      scope: "recruiter:applications:status",
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

    const { applicationId, status } = await request.json();
    if (!applicationId || !status) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "applicationId and status required",
        });
      }
      return NextResponse.json({ error: "applicationId and status required" }, { status: 400 });
    }

    await updateApplicationStatus(applicationId, { status });

    const payload = { success: true };

    if (idempotencyToken) {
      await completeIdempotencyLock({
        token: idempotencyToken,
        status: 200,
        body: payload,
      });
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("Status update error:", err);

    if (idempotencyToken) {
      await failIdempotencyLock({
        token: idempotencyToken,
        error: err,
      });
    }

    return NextResponse.json({ error: "Failed", details: (err as Error).message }, { status: 500 });
  }
}
