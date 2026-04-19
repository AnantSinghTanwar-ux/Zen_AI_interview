import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_COOKIE = __ENV.AUTH_COOKIE || "";
const CALL_ID = __ENV.CALL_ID || "sample-call-id";

export const options = {
  scenarios: {
    feedback_jobs_spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "60s", target: 60 },
        { duration: "90s", target: 120 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<700"],
  },
};

function authHeaders(extra = {}) {
  return {
    headers: {
      Cookie: AUTH_COOKIE,
      "Content-Type": "application/json",
      ...extra,
    },
  };
}

export default function () {
  const jobCreate = http.post(
    `${BASE_URL}/api/v2/feedback-jobs`,
    JSON.stringify({ callId: CALL_ID }),
    authHeaders({
      "X-Idempotency-Key": `${__VU}-${__ITER}-feedback-job`,
    })
  );

  check(jobCreate, {
    "feedback job create: accepted": (r) => r.status === 201 || r.status === 200,
  });

  let jobId = "";
  try {
    const body = JSON.parse(jobCreate.body || "{}");
    jobId = String(body.jobId || "");
  } catch {
    jobId = "";
  }

  if (jobId) {
    const statusRes = http.get(
      `${BASE_URL}/api/v2/feedback-jobs/${jobId}`,
      authHeaders()
    );

    check(statusRes, {
      "feedback job status: ok": (r) => r.status === 200,
    });
  }

  sleep(1);
}
