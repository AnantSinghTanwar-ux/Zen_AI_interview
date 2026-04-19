import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/services/firebase/admin";

const COLLECTION = "idempotency_records";

const DEFAULT_RESULT_TTL_MS = Number(
  process.env.IDEMPOTENCY_TTL_MS ?? 24 * 60 * 60 * 1000
);
const DEFAULT_PROCESSING_TTL_MS = Number(
  process.env.IDEMPOTENCY_PROCESSING_TTL_MS ?? 60 * 1000
);

export interface IdempotencyToken {
  recordId: string;
  ttlMs: number;
}

export type IdempotencyAcquireResult =
  | { state: "none" }
  | { state: "invalid"; error: string }
  | { state: "in-progress"; retryAfterSeconds: number }
  | { state: "replay"; status: number; body: unknown }
  | { state: "acquired"; token: IdempotencyToken };

function getIdempotencyKey(request: NextRequest): string {
  const key =
    request.headers.get("x-idempotency-key") ||
    request.headers.get("idempotency-key") ||
    "";

  return String(key).trim();
}

function hashRecordId(userId: string, scope: string, key: string): string {
  return createHash("sha256")
    .update(`${userId}:${scope}:${key}`)
    .digest("hex");
}

function getSafePositiveMs(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export async function acquireIdempotencyLock(params: {
  request: NextRequest;
  userId: string;
  scope: string;
  ttlMs?: number;
  processingTtlMs?: number;
}): Promise<IdempotencyAcquireResult> {
  const key = getIdempotencyKey(params.request);
  if (!key) {
    return { state: "none" };
  }

  if (key.length > 128) {
    return {
      state: "invalid",
      error: "Idempotency key must be 128 characters or fewer",
    };
  }

  const ttlMs = getSafePositiveMs(params.ttlMs ?? DEFAULT_RESULT_TTL_MS, DEFAULT_RESULT_TTL_MS);
  const processingTtlMs = getSafePositiveMs(
    params.processingTtlMs ?? DEFAULT_PROCESSING_TTL_MS,
    DEFAULT_PROCESSING_TTL_MS
  );

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const recordId = hashRecordId(params.userId, params.scope, key);
  const docRef = db.collection(COLLECTION).doc(recordId);

  let result: IdempotencyAcquireResult = { state: "none" };

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);

    if (snapshot.exists) {
      const data = (snapshot.data() || {}) as {
        status?: string;
        expiresAtMs?: number;
        response?: { status?: number; body?: unknown };
      };

      const expiresAtMs = Number(data.expiresAtMs || 0);
      const notExpired = expiresAtMs > now;

      if (notExpired && data.status === "completed" && data.response) {
        result = {
          state: "replay",
          status: Number(data.response.status || 200),
          body: data.response.body,
        };
        return;
      }

      if (notExpired && data.status === "processing") {
        const retryAfterSeconds = Math.max(1, Math.ceil((expiresAtMs - now) / 1000));
        result = {
          state: "in-progress",
          retryAfterSeconds,
        };
        return;
      }
    }

    transaction.set(
      docRef,
      {
        userId: params.userId,
        scope: params.scope,
        keyHash: recordId,
        status: "processing",
        response: null,
        error: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        expiresAtMs: now + processingTtlMs,
      },
      { merge: true }
    );

    result = {
      state: "acquired",
      token: {
        recordId,
        ttlMs,
      },
    };
  });

  return result;
}

export async function completeIdempotencyLock(params: {
  token: IdempotencyToken;
  status: number;
  body: unknown;
}) {
  const now = Date.now();
  await db.collection(COLLECTION).doc(params.token.recordId).set(
    {
      status: "completed",
      response: {
        status: params.status,
        body: params.body,
      },
      error: null,
      updatedAt: new Date(now).toISOString(),
      expiresAtMs: now + params.token.ttlMs,
    },
    { merge: true }
  );
}

export async function failIdempotencyLock(params: {
  token: IdempotencyToken;
  error?: unknown;
}) {
  const now = Date.now();
  const errorMessage =
    params.error instanceof Error
      ? params.error.message
      : String(params.error || "Idempotent operation failed");

  await db.collection(COLLECTION).doc(params.token.recordId).set(
    {
      status: "failed",
      error: errorMessage,
      response: null,
      updatedAt: new Date(now).toISOString(),
      // Keep a short failed TTL to allow quick retry with the same key.
      expiresAtMs: now + Math.min(30_000, Math.max(5_000, Math.floor(params.token.ttlMs / 20))),
    },
    { merge: true }
  );
}
