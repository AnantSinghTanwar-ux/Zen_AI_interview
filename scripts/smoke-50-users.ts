import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { auth as adminAuth } from "../services/firebase/admin";
import { RECRUITER_EMAIL } from "../types/external-application";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const USER_COUNT = Number(process.env.CONCURRENCY_USER_COUNT || 50);
const AUTH_POOL_SIZE = Number(process.env.AUTH_POOL_SIZE || 8);
const FEATURE_POOL_SIZE = Number(process.env.FEATURE_POOL_SIZE || 25);
const SESSION_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

if (!FIREBASE_API_KEY) {
  throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is required");
}

type Method = "GET" | "POST" | "PATCH";

interface SessionUser {
  email: string;
  uid: string;
  cookie: string;
}

interface ProbeResult {
  user: string;
  endpoint: string;
  method: Method;
  status: number;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

interface ProbeDefinition {
  method: Method;
  path: string;
  body?: unknown;
  allowedStatuses: number[];
  includeCookie?: boolean;
}

interface RecruiterProbeSummary {
  ok: boolean;
  message: string;
  results: ProbeResult[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(maxWaitMs: number = 60_000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.status === 200 || res.status === 503) {
        return;
      }
    } catch {
      // Keep retrying while server boots.
    }

    await sleep(1000);
  }

  throw new Error(`Server did not become ready within ${maxWaitMs}ms at ${BASE_URL}`);
}

async function runWithPool<T, R>(
  items: T[],
  poolSize: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const safePoolSize = Math.max(1, Math.min(poolSize, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: safePoolSize }, () => runWorker()));
  return results;
}

async function firebaseAuthRequest<T>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ||
      `Firebase request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

async function ensureUserSession(index: number): Promise<SessionUser> {
  const id = randomUUID().slice(0, 8);
  const email = `loadtest_user_${Date.now()}_${index}_${id}@zenai.local`;
  const password = `LoadTest!${id}${index}`;

  await firebaseAuthRequest("accounts:signUp", {
    email,
    password,
    returnSecureToken: true,
  });

  const signInPayload = await firebaseAuthRequest<{
    idToken: string;
    localId: string;
  }>("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });

  const sessionCookie = await adminAuth.createSessionCookie(signInPayload.idToken, {
    expiresIn: SESSION_EXPIRES_MS,
  });

  return {
    email,
    uid: signInPayload.localId,
    cookie: `session=${sessionCookie}`,
  };
}

async function getRecruiterSession(): Promise<SessionUser | null> {
  try {
    const recruiter = await adminAuth.getUserByEmail(RECRUITER_EMAIL);
    const customToken = await adminAuth.createCustomToken(recruiter.uid);

    const signInPayload = await firebaseAuthRequest<{
      idToken: string;
      localId: string;
      email?: string;
    }>("accounts:signInWithCustomToken", {
      token: customToken,
      returnSecureToken: true,
    });

    const sessionCookie = await adminAuth.createSessionCookie(signInPayload.idToken, {
      expiresIn: SESSION_EXPIRES_MS,
    });

    return {
      email: signInPayload.email || RECRUITER_EMAIL,
      uid: signInPayload.localId,
      cookie: `session=${sessionCookie}`,
    };
  } catch (error) {
    return null;
  }
}

async function runProbe(
  userLabel: string,
  cookie: string,
  probe: ProbeDefinition
): Promise<ProbeResult> {
  const started = Date.now();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (probe.includeCookie !== false) {
    headers.Cookie = cookie;
  }

  try {
    const response = await fetch(`${BASE_URL}${probe.path}`, {
      method: probe.method,
      headers,
      body: probe.body ? JSON.stringify(probe.body) : undefined,
    });

    return {
      user: userLabel,
      endpoint: probe.path,
      method: probe.method,
      status: response.status,
      ok: probe.allowedStatuses.includes(response.status),
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      user: userLabel,
      endpoint: probe.path,
      method: probe.method,
      status: 0,
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runCandidateFeatureChecks(user: SessionUser): Promise<ProbeResult[]> {
  const callId = `loadtest-call-${user.uid}-${Date.now()}`;
  const probes: ProbeDefinition[] = [
    {
      method: "GET",
      path: "/api/health",
      allowedStatuses: [200, 503],
      includeCookie: false,
    },
    {
      method: "POST",
      path: "/api/premium/vapi-access",
      body: {
        feature: "voice-interview",
        usageKey: `voice-interview:${user.uid}:${Date.now()}`,
        quotaKind: "interview",
      },
      allowedStatuses: [200, 402, 429],
    },
    {
      method: "GET",
      path: "/api/vapi/call-data?limit=5",
      allowedStatuses: [200, 402, 429],
    },
    {
      method: "POST",
      path: "/api/vapi/call-data/sync",
      body: { limit: 1, dryRun: true },
      allowedStatuses: [200, 402, 429],
    },
    {
      method: "GET",
      path: "/api/v2/feedback-jobs",
      allowedStatuses: [200],
    },
    {
      method: "POST",
      path: "/api/v2/feedback-jobs",
      body: { callId },
      allowedStatuses: [200, 201, 402, 429],
    },
    {
      method: "GET",
      path: "/api/call-logs?limit=5",
      allowedStatuses: [200],
    },
    {
      method: "GET",
      path: "/api/vapi/test?limit=1",
      allowedStatuses: [200, 500],
    },
  ];

  const results: ProbeResult[] = [];

  for (const probe of probes) {
    const result = await runProbe(user.email, user.cookie, probe);
    results.push(result);

    // If we created a feedback job successfully, attempt one status check.
    if (probe.path === "/api/v2/feedback-jobs" && probe.method === "POST") {
      if (result.status === 200 || result.status === 201) {
        try {
          const response = await fetch(`${BASE_URL}/api/v2/feedback-jobs`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Cookie: user.cookie,
            },
          });

          const body = await response.json().catch(() => []);
          const firstJobId = Array.isArray(body) && body.length > 0 ? String(body[0].id || "") : "";

          if (firstJobId) {
            results.push(
              await runProbe(user.email, user.cookie, {
                method: "GET",
                path: `/api/v2/feedback-jobs/${firstJobId}`,
                allowedStatuses: [200],
              })
            );
          }
        } catch {
          results.push({
            user: user.email,
            endpoint: "/api/v2/feedback-jobs/:jobId",
            method: "GET",
            status: 0,
            ok: false,
            latencyMs: 0,
            error: "Failed to fetch feedback job status",
          });
        }
      }
    }
  }

  return results;
}

async function runRecruiterFeatureChecks(recruiter: SessionUser | null): Promise<RecruiterProbeSummary> {
  if (!recruiter) {
    return {
      ok: false,
      message: `Recruiter session skipped: could not create session for ${RECRUITER_EMAIL}`,
      results: [],
    };
  }

  const probes: ProbeDefinition[] = [
    {
      method: "GET",
      path: "/api/v2/recruiter/dashboard",
      allowedStatuses: [200],
    },
    {
      method: "GET",
      path: "/api/v2/recruiter/leaderboard?limit=5",
      allowedStatuses: [200],
    },
    {
      method: "GET",
      path: "/api/v2/recruiter/applications?limit=10",
      allowedStatuses: [200],
    },
    {
      method: "GET",
      path: "/api/v2/recruiter/jobs",
      allowedStatuses: [200],
    },
  ];

  const results: ProbeResult[] = [];
  for (const probe of probes) {
    results.push(await runProbe(recruiter.email, recruiter.cookie, probe));
  }

  return {
    ok: results.every((item) => item.ok),
    message: "Recruiter endpoints executed",
    results,
  };
}

function summarizeResults(results: ProbeResult[]) {
  const endpointMap = new Map<string, { total: number; ok: number; fail: number; latencies: number[] }>();

  for (const result of results) {
    const key = `${result.method} ${result.endpoint}`;
    const current = endpointMap.get(key) || { total: 0, ok: 0, fail: 0, latencies: [] };
    current.total += 1;
    if (result.ok) current.ok += 1;
    else current.fail += 1;
    current.latencies.push(result.latencyMs);
    endpointMap.set(key, current);
  }

  const perEndpoint = Array.from(endpointMap.entries()).map(([endpoint, value]) => {
    const sorted = [...value.latencies].sort((a, b) => a - b);
    const p95 = sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
    const avg =
      sorted.length > 0
        ? Math.round(sorted.reduce((sum, latency) => sum + latency, 0) / sorted.length)
        : 0;

    return {
      endpoint,
      total: value.total,
      ok: value.ok,
      fail: value.fail,
      passRate: `${Math.round((value.ok / Math.max(1, value.total)) * 100)}%`,
      avgLatencyMs: avg,
      p95LatencyMs: p95,
    };
  });

  const total = results.length;
  const ok = results.filter((result) => result.ok).length;
  const fail = total - ok;

  return {
    total,
    ok,
    fail,
    passRate: `${Math.round((ok / Math.max(1, total)) * 100)}%`,
    perEndpoint,
    failures: results.filter((result) => !result.ok).slice(0, 30),
  };
}

async function main() {
  console.log(`[smoke-50] Waiting for server at ${BASE_URL} ...`);
  await waitForServer();
  console.log("[smoke-50] Server ready");

  const userIndexes = Array.from({ length: USER_COUNT }, (_, index) => index + 1);
  console.log(`[smoke-50] Creating and logging in ${USER_COUNT} random users ...`);

  const users = await runWithPool(userIndexes, AUTH_POOL_SIZE, async (index) =>
    ensureUserSession(index)
  );

  console.log(`[smoke-50] Authenticated users: ${users.length}`);

  console.log("[smoke-50] Running candidate feature probes concurrently ...");
  const candidateProbeResults = await runWithPool(users, FEATURE_POOL_SIZE, async (user) =>
    runCandidateFeatureChecks(user)
  );

  const flatCandidateResults = candidateProbeResults.flat();

  console.log("[smoke-50] Running recruiter-only probes ...");
  const recruiterSession = await getRecruiterSession();
  const recruiterSummary = await runRecruiterFeatureChecks(recruiterSession);

  const allResults = [...flatCandidateResults, ...recruiterSummary.results];
  const summary = summarizeResults(allResults);

  const output = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    users: {
      requested: USER_COUNT,
      authenticated: users.length,
    },
    recruiter: {
      executed: recruiterSummary.results.length,
      ok: recruiterSummary.ok,
      message: recruiterSummary.message,
    },
    summary,
  };

  const outputDir = join(process.cwd(), "load-tests", "results");
  mkdirSync(outputDir, { recursive: true });
  const outputFile = join(outputDir, `smoke-50-users-${Date.now()}.json`);
  writeFileSync(outputFile, JSON.stringify(output, null, 2), "utf8");

  console.log("\n[smoke-50] ===== Summary =====");
  console.log(`[smoke-50] Total probes: ${summary.total}`);
  console.log(`[smoke-50] Passed: ${summary.ok}`);
  console.log(`[smoke-50] Failed: ${summary.fail}`);
  console.log(`[smoke-50] Pass rate: ${summary.passRate}`);
  console.log(`[smoke-50] Result file: ${outputFile}`);

  if (summary.fail > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[smoke-50] Fatal error:", error);
  process.exit(1);
});
