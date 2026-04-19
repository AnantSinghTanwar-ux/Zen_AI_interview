import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { recruiterService } from "@/services/recruiter/recruiter.service";
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
      scope: "recruiter:signup",
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

    if (!data.companyName || !data.industry) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "companyName and industry are required",
        });
      }
      return NextResponse.json(
        { error: "companyName and industry are required" },
        { status: 400 }
      );
    }

    const recruiterId = await recruiterService.createRecruiterProfile({
      userId: user.id,
      companyName: data.companyName,
      industry: data.industry,
      role: data.role || "recruiter",
      jobsCreated: 0,
      applicantsScreened: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const payload = { recruiterId, success: true };

    if (idempotencyToken) {
      await completeIdempotencyLock({
        token: idempotencyToken,
        status: 201,
        body: payload,
      });
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error("Error in recruiter signup:", error);

    if (idempotencyToken) {
      await failIdempotencyLock({
        token: idempotencyToken,
        error,
      });
    }

    return NextResponse.json(
      { error: "Failed to create recruiter profile" },
      { status: 500 }
    );
  }
}
