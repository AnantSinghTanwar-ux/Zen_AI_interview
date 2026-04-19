# ZenAI Load Test Harness

This folder contains k6 scripts for the immediate scaling sprint.

## Prerequisites

- k6 installed locally: https://k6.io/docs/get-started/installation/
- A valid authenticated session cookie for test users

## Environment Variables

- `BASE_URL` (default: `http://localhost:3000`)
- `AUTH_COOKIE` (required for authenticated APIs)
- `CALL_ID` (for feedback job tests)
- `VAPI_CALL_ID` (for call completion tests)

## Scripts

- `k6/feedback-jobs.js`
  - Exercises feedback queue create/poll flow
  - Validates p95 and error rate against API SLO

- `k6/interview-and-sync.js`
  - Exercises call completion write path and bounded sync path
  - Validates request latency and failure budget

## Example Commands

```bash
k6 run load-tests/k6/feedback-jobs.js \
  -e BASE_URL=http://localhost:3000 \
  -e AUTH_COOKIE="session=<cookie>" \
  -e CALL_ID="<call-id>"
```

```bash
k6 run load-tests/k6/interview-and-sync.js \
  -e BASE_URL=http://localhost:3000 \
  -e AUTH_COOKIE="session=<cookie>" \
  -e VAPI_CALL_ID="<vapi-call-id>"
```

## Target Validation

Use these scripts to validate:

- API p95 < 700ms (non-AI endpoints)
- Error rate < 1%
- Queue backlog drain behavior under burst traffic
