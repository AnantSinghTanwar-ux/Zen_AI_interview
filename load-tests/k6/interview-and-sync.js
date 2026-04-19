import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_COOKIE = __ENV.AUTH_COOKIE || "";
const VAPI_CALL_ID = __ENV.VAPI_CALL_ID || "sample-vapi-call-id";

export const options = {
  scenarios: {
    interview_completion_and_sync: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 25 },
        { duration: "60s", target: 75 },
        { duration: "90s", target: 150 },
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
  const callLog = http.post(
    `${BASE_URL}/api/call-logs`,
    JSON.stringify({ vapiCallId: VAPI_CALL_ID }),
    authHeaders({
      "X-Idempotency-Key": `${__VU}-${__ITER}-call-log`,
    })
  );

  check(callLog, {
    "call-logs: ok": (r) => r.status === 200,
  });

  const syncRes = http.post(
    `${BASE_URL}/api/vapi/call-data/sync`,
    JSON.stringify({ limit: 3 }),
    authHeaders()
  );

  check(syncRes, {
    "call-data sync: ok": (r) => r.status === 200,
  });

  const listRes = http.get(
    `${BASE_URL}/api/vapi/call-data?limit=10`,
    authHeaders()
  );

  check(listRes, {
    "call-data list: ok": (r) => r.status === 200,
  });

  sleep(1);
}
