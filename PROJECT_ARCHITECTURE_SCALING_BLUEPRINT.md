# ZenAI Architecture and Scaling Blueprint

## 1) Executive Summary

This document maps the current architecture, API workflow, system gaps, and a target architecture to scale ZenAI to:

- 500 concurrent active users on the platform
- 200 simultaneous real-time interview sessions

It is based on repository inspection of the current Next.js/Firebase/Vapi/OpenRouter implementation.

---

## 2) Current Architecture (As Implemented)

### 2.1 Runtime and Application Shape

- Frontend and backend are in a single Next.js App Router codebase.
- API routes are hosted in the same Next.js deployment.
- Main runtime domains:
  - Candidate interview flow and feedback
  - Recruiter pipeline and scoring
  - Gamification and analytics
  - Chrome extension ingestion path

### 2.2 Core Dependencies

- Next.js 15 + React 19 + TypeScript
- Firebase Admin SDK + Firestore
- Vapi (live voice interview and call data)
- OpenRouter (AI scoring and feedback)
- Redis client with in-memory fallback for:
  - Caching
  - Rate limiting

### 2.3 Data Stores and Collections

Firestore collections used in active flow include:

- users
- callLogs
- external_applications
- application_scores
- feedback_jobs
- interview_feedback
- interviews

### 2.4 Key Services

- Premium access and daily quotas:
  - lib/services/premium-access.service.ts
- Rate limiting:
  - lib/services/rate-limit.service.ts
- Caching:
  - lib/services/cache.service.ts
- Retry and resilience:
  - lib/services/retry.service.ts
  - lib/services/circuit-breaker.service.ts
- Interview evaluation:
  - services/interview/interview-evaluation.service.ts
- Feedback generation:
  - app/api/vapi/feedback/route.ts
  - services/feedback/feedback.service.ts
  - services/feedback/feedback-worker.ts

---

## 3) Current API Workflow (End-to-End)

## 3.1 Candidate Real-Time Interview Flow

1. Client precheck for premium/quota access:
   - POST /api/premium/vapi-access
2. Session starts from frontend Vapi SDK:
   - components/Agent.tsx
3. During/after call, call data APIs are used:
   - GET /api/vapi/call-data
   - GET /api/vapi/call-data/[callId]
4. Evaluation endpoint can be requested:
   - POST /api/vapi/call-data/[callId]/evaluation
5. Transcript feedback is generated:
   - GET /api/vapi/feedback?callId=...

## 3.2 Call Persistence and Recruiter Auto-Scoring Flow

1. Candidate call completion is persisted:
   - POST /api/call-logs
2. API fetches call details from Vapi and stores normalized call log in Firestore.
3. If extension job context exists:
   - external_application is auto-created/updated
   - recruiter score is generated and stored in application_scores

## 3.3 Extension Workflow

1. Chrome extension content script extracts job details.
2. Background script forwards sanitized payload.
3. User is redirected to interview page with encoded job context.
4. After interview, POST /api/call-logs consumes job context to create recruiter artifacts.

## 3.4 Async Feedback Jobs

1. Job queued:
   - POST /api/v2/feedback-jobs
2. Status polling:
   - GET /api/v2/feedback-jobs/[jobId]
3. Worker process pulls pending jobs and writes completion:
   - services/feedback/feedback-worker.ts

## 3.5 Recruiter V2 Surface

Representative endpoints:

- /api/v2/recruiter/dashboard
- /api/v2/recruiter/leaderboard
- /api/v2/recruiter/applications
- /api/v2/recruiter/applications/status
- /api/v2/recruiter/jobs
- /api/v2/recruiter/jobs/[jobId]
- /api/v2/recruiter/export
- /api/v2/recruiter/signup

---

## 4) Harsh Real-World Analysis Policy (Now Enforced)

The code now applies two layers:

1. Prompt-level strict instructions in major analysis paths.
2. Deterministic post-processing guardrails that cap scores when evidence is missing.

Guardrail implementation:

- services/ai/analysis-guardrails.ts

Applied in:

- app/api/vapi/feedback/route.ts
- services/interview/interview-evaluation.service.ts
- app/api/call-logs/route.ts
- app/api/v2/recruiter/dashboard/route.ts
- services/feedback/feedback.service.ts
- services/ai/gemini-provider.ts
- services/ai/local-model.provider.ts

Policy behavior:

- If technical depth is not demonstrated, technical scores are capped.
- If problem-solving walkthrough is absent, problem-solving scores are capped.
- Resume-only or vague responses are penalized.
- Overall score is bounded by component-level evidence.

---

## 5) Best-Fit Model Assignment for Analysis

Recommended production model chain for strict analysis:

1. OPENROUTER_HARSH_ANALYSIS_MODEL
2. OPENROUTER_EVALUATION_MODEL
3. openai/gpt-4.1-mini
4. OPENROUTER_MODEL
5. GOOGLE_AI_FEEDBACK_MODEL
6. openrouter/auto

Recommended env values:

- OPENROUTER_HARSH_ANALYSIS_MODEL=openai/gpt-4.1-mini
- OPENROUTER_EVALUATION_MODEL=openai/gpt-4.1-mini

Reasoning:

- Good JSON reliability under constrained output
- Strong instruction-following for rubric-style scoring
- Better cost/performance balance than larger premium models for high-volume scoring

---

## 6) Current Bottlenecks and Missing Pieces

## 6.1 Throughput and Latency Risks

- Monolithic deployment (UI + APIs + orchestration) can saturate under spikes.
- Several request paths still perform synchronous external calls (Vapi/OpenRouter) in user-facing requests.
- call-data sync endpoint exists but is currently empty:
  - app/api/vapi/call-data/sync/route.ts

## 6.2 Horizontal Scale Risks

- In-memory fallback for cache/rate-limit causes per-instance divergence.
- Without sticky/session externalization, behavior can vary by instance.

## 6.3 Data and Pipeline Risks

- Auto-scoring in call-logs path may contend under burst completion windows.
- Firestore query/index growth will increase latency without index and partition planning.
- No explicit idempotency keys on all write-heavy endpoints.

## 6.4 Realtime Session Risks

- No dedicated real-time orchestration service for 200 simultaneous sessions.
- Limited explicit backpressure controls for transcript/event ingestion.

## 6.5 Observability Gaps

- Health endpoint exists but no full SLO dashboard stack is wired.
- Missing standard traces across route -> service -> external dependency.

---

## 7) Target Scalable Architecture (500 Concurrent, 200 Real-Time Interviews)

## 7.1 Topology

Adopt a split architecture:

- Web Tier
  - Next.js web servers for pages and lightweight APIs
- API Tier
  - Dedicated API service for interview orchestration and stateful workflows
- Worker Tier
  - Queue consumers for feedback/evaluation/recruiter scoring
- Realtime Session Tier
  - Session state + event fanout over managed Redis
- Data Tier
  - Firestore as source of truth
  - Redis as hot cache/rate-limit/session state
  - Optional BigQuery for analytics and historical reporting

## 7.2 Critical Design Decisions

- Make all heavy scoring async-first (queue-backed), return job IDs.
- Keep synchronous request budgets small (sub-500ms where possible).
- Use idempotency tokens for POST writes.
- Introduce durable event queue for call completion and analysis tasks.

## 7.3 Capacity Planning Targets

Design assumptions:

- 200 simultaneous interview sessions
- average 1-2 significant backend events per session every 5-10 seconds
- bursty interview completion windows

Target budgets:

- API p95 latency < 700ms (non-AI endpoints)
- Analysis enqueue p95 < 300ms
- Queue backlog drain under peak < 2 minutes
- Error budget <= 1% for realtime endpoints

## 7.4 Candidate Session Reliability Controls

- Session registry in Redis keyed by interview session ID.
- Heartbeat and stale-session reaper.
- Rate-limited event ingestion with short-lived buffers.
- Graceful degradation if OpenRouter unavailable:
  - queue and retry
  - temporary partial score status in UI

---

## 8) Concrete API and Service Refactor Plan

## Phase 1: Stabilize for 100-150 concurrent users

1. Move all recruiter auto-scoring to queue worker path.
2. Replace synchronous score generation in call-logs route with enqueue operation.
3. Enforce Redis-only in production (disable in-memory fallback there).
4. Add idempotency keys to:
   - POST /api/call-logs
   - POST /api/v2/feedback-jobs
   - recruiter write endpoints

## Phase 2: Scale to 500 concurrent users

1. Split deployment:
   - web service
   - api service
   - worker service
2. Introduce managed queue (for example Cloud Tasks/PubSub/SQS equivalent).
3. Introduce distributed tracing and centralized logs.
4. Add endpoint-level SLO alarms and auto-scaling policies.

## Phase 3: Reach 200 real-time interview sessions

1. Add dedicated realtime session coordinator service.
2. Add Redis-backed session state and event throttling.
3. Add per-session admission control and overload protection.
4. Add live operational dashboard:
   - active sessions
   - queue depth
   - AI error rate
   - Firestore write/read latency

---

## 9) Database and Index Strategy

Mandatory index and data model improvements:

- Verify composite indexes for frequent recruiter and call log queries.
- Partition large collections by time where practical.
- Archive old call artifacts to cold storage after retention threshold.
- Store denormalized score snapshots for leaderboard read efficiency.

---

## 10) Security and Compliance Hardening

- Move extension base URL and API targets to environment-managed config.
- Ensure no service account secrets are committed.
- Strict IAM roles for worker vs web vs admin tasks.
- Add webhook validation if introducing external callbacks.

---

## 11) Implementation Prompt (Full-Scale Execution)

Use the following prompt to drive full implementation in iterative sprints:

"""
You are the lead architect and principal engineer for ZenAI.

Goal:
Scale the current Next.js + Firebase + Vapi + OpenRouter system to support 500 concurrent users and 200 simultaneous real-time interview sessions with strict evidence-based scoring.

Hard constraints:
1) Keep existing product features and API contracts backward-compatible unless marked for versioned migration.
2) Move heavy analysis/scoring off request path into queue-backed workers.
3) Add deterministic scoring guardrails so technical/problem-solving scores are capped when transcript evidence is missing.
4) Implement production-grade observability (structured logs, traces, metrics, SLO alarms).
5) Eliminate in-memory fallback behavior in production for cache/rate-limits.
6) Add idempotency and retry safety for write endpoints.

Deliverables:
1) Architecture refactor PR plan with phases and rollback strategy.
2) Queue and worker implementation for feedback/evaluation/recruiter scoring.
3) Realtime session coordinator with Redis-backed session state.
4) API changes required for async job lifecycle and polling/webhook model.
5) Firestore index and schema optimization migration plan.
6) Load-test scripts and target results for:
   - 500 concurrent app users
   - 200 concurrent interview sessions
7) Runbook and operational dashboard definitions.

Success criteria:
- API p95 under target budgets.
- Queue backlog clears within 2 minutes at peak.
- No inflated scoring on low-evidence transcripts.
- Error rate under 1% on critical interview endpoints.

Work mode:
- Implement in small, reviewable commits.
- Include tests and migration notes for each change.
- Provide explicit risk log and fallback plan per phase.
"""

---

## 12) Immediate Next Sprint (Highest ROI)

1. Convert call completion scoring to async queue + worker.
2. Implement call-data sync route with bounded pull and idempotent updates.
3. Add production-only guard: fail startup if Redis is unavailable.
4. Add end-to-end load test harness for interview and feedback APIs.
5. Add dashboards and alerts for queue depth, OpenRouter failures, and Firestore latency.
