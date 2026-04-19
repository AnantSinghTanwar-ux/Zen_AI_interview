# ZenAI Scaling Runbook

## Scope

Operational playbook for:

- Queue backlog spikes
- Redis outages
- OpenRouter degradation
- Firestore latency/error regressions

## Quick Checks

1. Check health endpoint: `/api/health`
2. Verify queues:
   - `feedback_jobs` pending/failed
   - `recruiter_score_jobs` pending/failed
3. Confirm Redis is connected and required mode is satisfied.
4. Validate OpenRouter quota and error rates.

## Incident Playbooks

## A) Queue Backlog Spike

Symptoms:

- Pending jobs climbing continuously
- Dashboard score availability delayed

Actions:

1. Scale worker replicas.
2. Verify worker logs for repeated failures.
3. Check Firestore index health and query latency.
4. If OpenRouter degraded, keep enqueueing and communicate delayed scoring.

Exit criteria:

- Backlog trending down
- Queue drain < 2 minutes at current load

## B) Redis Outage (Production)

Symptoms:

- Health endpoint degraded
- Startup guard fails on new instances

Actions:

1. Validate Redis service and credentials (`REDIS_URL`).
2. Restore connectivity before rolling new app instances.
3. Confirm `/api/health` reports Redis connected.

Exit criteria:

- Redis connected
- New web and worker instances start successfully

## C) OpenRouter Degradation

Symptoms:

- Increased 429/5xx from model calls
- Rising queue retries and failed jobs

Actions:

1. Verify plan credits and rate limits.
2. Temporarily reduce concurrency in worker.
3. Keep async queue path active to avoid request path failures.
4. Review strict model fallback env vars.

Exit criteria:

- Error rate normalizes
- Failed jobs stop increasing

## D) Firestore Latency/Index Issues

Symptoms:

- Increased API latency on list/filter endpoints
- Query failures indicating missing indexes

Actions:

1. Deploy latest `firestore.indexes.json`.
2. Reduce expensive dashboard refresh intervals.
3. Validate collection query patterns against indexes.

Exit criteria:

- Query error rate < 1%
- API p95 restored under target

## SLO Targets

- API p95 < 700ms (non-AI endpoints)
- Queue backlog drain < 2 minutes under peak
- Critical endpoint error budget <= 1%

## Post-Incident

1. Document root cause and timeline.
2. Add regression checks/load test scenario.
3. Update alert thresholds if needed.
