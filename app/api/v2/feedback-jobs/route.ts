import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { db } from "@/services/firebase/admin";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  failIdempotencyLock,
  IdempotencyToken,
} from "@/lib/services/idempotency.service";

function isMissingIndexError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as {
    code?: unknown;
    details?: unknown;
    message?: unknown;
  };

  const code = typeof maybeError.code === "number" ? maybeError.code : null;
  const details = typeof maybeError.details === "string" ? maybeError.details : "";
  const message = typeof maybeError.message === "string" ? maybeError.message : "";

  if (code !== 9) return false;

  return (
    details.toLowerCase().includes("query requires an index") ||
    message.toLowerCase().includes("query requires an index")
  );
}

function toMillis(value: unknown): number {
  if (!value) return 0;

  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.getTime();
  }

  return 0;
}

/**
 * POST /api/v2/feedback-jobs — Queue a new feedback generation job.
 * GET  /api/v2/feedback-jobs — List jobs for the authenticated user.
 */

export async function POST(request: NextRequest) {
  let idempotencyToken: IdempotencyToken | null = null;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit
    const { allowed, response } = await checkRateLimit(request, user.id, "feedback-job-create");
    if (!allowed) return response!;

    const idempotency = await acquireIdempotencyLock({
      request,
      userId: user.id,
      scope: "feedback-jobs:create",
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

    const body = await request.json();
    const callId: string | undefined = body?.callId;

    if (!callId) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "callId is required",
        });
      }
      return NextResponse.json({ error: "callId is required" }, { status: 400 });
    }

    // Deduplicate — if a job already exists for this call, return it.
    const existing = await db
      .collection("feedback_jobs")
      .where("callId", "==", callId)
      .where("userId", "==", user.id)
      .where("status", "in", ["pending", "processing", "completed"])
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      const payload = { jobId: doc.id, status: doc.data().status };

      if (idempotencyToken) {
        await completeIdempotencyLock({
          token: idempotencyToken,
          status: 200,
          body: payload,
        });
      }

      return NextResponse.json(payload, { status: 200 });
    }

    // Create new job
    const jobData = {
      userId: user.id,
      callId,
      status: "pending",
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      feedback: null,
      error: null,
      retryCount: 0,
      modelUsed: null,
      processingTimeMs: 0,
    };

    const docRef = await db.collection("feedback_jobs").add(jobData);

    const payload = { jobId: docRef.id, status: "pending" };

    if (idempotencyToken) {
      await completeIdempotencyLock({
        token: idempotencyToken,
        status: 201,
        body: payload,
      });
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error("[FeedbackJobs] POST error:", error);

    if (idempotencyToken) {
      await failIdempotencyLock({
        token: idempotencyToken,
        error,
      });
    }

    return NextResponse.json(
      { error: "Failed to create feedback job" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "feedback-job-status");
    if (!allowed) return response!;

    let snapshot;

    try {
      snapshot = await db
        .collection("feedback_jobs")
        .where("userId", "==", user.id)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
    } catch (queryError) {
      if (!isMissingIndexError(queryError)) {
        throw queryError;
      }

      console.warn(
        "[FeedbackJobs] Missing index for ordered query; using fallback unsorted query",
        queryError
      );

      snapshot = await db
        .collection("feedback_jobs")
        .where("userId", "==", user.id)
        .get();
    }

    const jobs = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort(
        (a, b) =>
          toMillis((b as { createdAt?: unknown }).createdAt) -
          toMillis((a as { createdAt?: unknown }).createdAt)
      )
      .slice(0, 50);

    return NextResponse.json(jobs, { status: 200 });
  } catch (error) {
    console.error("[FeedbackJobs] GET error:", error);
    return NextResponse.json(
      { error: "Failed to list feedback jobs" },
      { status: 500 }
    );
  }
}
