# ZenAI Dashboard and Alert Plan

This document defines dashboards and alert thresholds for the 500 concurrent users / 200 real-time interviews target.

## Dashboard Sections

## 1) API Health and Latency

Metrics:

- `http_requests_total` by route and status
- `http_request_duration_ms` p50/p95/p99 by route
- `http_429_total`, `http_5xx_total`

Panels:

- Overall request rate
- p95 latency by API group (`/api/vapi/*`, `/api/v2/*`, `/api/call-logs`)
- Error rate by route

Alerts:

- `critical-api-p95`: p95 > 700ms for 10m
- `critical-api-errors`: 5xx rate > 1% for 5m

## 2) Queue Health

Metrics:

- `feedback_jobs.pending`, `feedback_jobs.processing`, `feedback_jobs.failed`
- `recruiter_score_jobs.pending`, `recruiter_score_jobs.processing`, `recruiter_score_jobs.failed`
- Worker processing duration average and p95

Panels:

- Pending queue depth (feedback + recruiter score)
- Worker throughput (jobs/min)
- Failure counts and retry counts

Alerts:

- `critical-feedback-backlog`: `feedback_jobs.pending > 100` for 10m
- `critical-recruiter-backlog`: `recruiter_score_jobs.pending > 100` for 10m
- `warning-queue-failures`: failed jobs increase by > 20 in 15m

## 3) Dependency Health

Metrics:

- Redis connected state from `/api/health`
- OpenRouter request failures and latency
- Firestore query latency and error count

Panels:

- Redis mode (`redis` vs `in-memory`) and connectivity
- OpenRouter error rate (429, 5xx)
- Firestore read/write error rate

Alerts:

- `critical-redis-disconnected`: Redis required and disconnected for 2m
- `critical-openrouter-failures`: OpenRouter failure rate > 5% for 10m
- `warning-firestore-errors`: Firestore errors > 1% for 10m

## 4) Interview Session Reliability

Metrics:

- Active interview sessions
- Call completion events per minute
- Sync endpoint success/failure (`/api/vapi/call-data/sync`)

Panels:

- Active sessions vs target capacity
- Sync endpoint p95 latency and failures
- Session completion throughput

Alerts:

- `warning-sync-failure-spike`: sync failures > 2% for 10m
- `critical-session-capacity`: active sessions > 200 for 5m

## Alert Routing

- `critical-*`: Pager/on-call
- `warning-*`: Slack/Teams channel

## Runbook Linkage

- Operational response steps: `docs/operations/scaling-runbook.md`
