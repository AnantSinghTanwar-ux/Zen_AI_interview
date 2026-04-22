# ZenAI Project Workflow, Architecture, and User Flow

## 1. What ZenAI is
ZenAI is a Next.js 15 full-stack application that combines:
- Candidate interview practice (voice + DSA)
- AI-generated feedback and evaluations
- Recruiter-facing external application tracking and scoring
- A Chrome extension that injects real job context into interview sessions

It is a monorepo-style single app where UI and API routes live in the same codebase.

## 2. Core architecture in one view

### Frontend layer
- App Router pages in `app/(auth)` and `app/(root)`
- Main interview UI in `components/Agent.tsx`
- Practice setup UI in `components/PracticeSessionBuilder.tsx`
- Recruiter UI in `components/recruiter/RecruiterDashboard.tsx`

### Backend/API layer
- Next.js route handlers in `app/api/**`
- Auth/session server actions in `lib/actions/auth.actions.ts`
- Shared backend services in `lib/services/**` and `services/**`

### External integrations
- Firebase Auth + Firestore (primary identity/data store)
- Vapi (voice calls, call artifacts, transcripts)
- OpenRouter (LLM scoring and analysis)
- Redis (cache/rate limit backing store, with in-memory fallback in non-strict mode)

### Async processing
- Background worker process in `services/feedback/feedback-worker.ts`
- Handles both feedback jobs and recruiter scoring jobs

## 3. Runtime/component boundaries

### A) Authentication and session boundary
- Client login is handled in `components/AuthForm.tsx` using Firebase client auth.
- ID token is sent to server action `signIn` (`lib/actions/auth.actions.ts`).
- Server creates HTTP-only `session` cookie via `setSessionCookie`.
- `getCurrentUser` validates cookie on server for API/page access.

### B) Candidate interview boundary
- `app/(root)/interview/page.tsx` loads user and optional job context.
- `components/PracticeSessionBuilder.tsx` prepares company/role/focus context.
- `components/Agent.tsx` drives live Vapi voice interview.
- On call end, `useCallLogs.saveCallLog` posts to `POST /api/call-logs`.

### C) Analysis boundary
- `GET /api/vapi/feedback` generates feedback from transcript.
- `POST /api/vapi/call-data/[callId]/evaluation` generates strict rubric evaluation.
- `GET/POST /api/vapi/call-data/[callId]/emotion` handles emotion analysis.
- `POST /api/v2/feedback-jobs` queues async feedback generation.

### D) Recruiter boundary
- Recruiter APIs under `app/api/v2/recruiter/**`.
- Access controlled by `recruiterGuard()` and hardcoded recruiter email.
- Dashboard + leaderboard + bulk status + interview assign + import/export.

## 4. Firestore collections and purpose

- `users`: profile, premium flags, free-trial flags, daily usage counters.
- `callLogs`: canonical persisted call records per user.
- `feedback_jobs`: async feedback queue lifecycle (`pending/processing/completed/failed`).
- `interview_feedback`: generated feedback history and stats.
- `external_applications`: recruiter pipeline entities sourced manually or from extension context.
- `application_scores`: recruiter-facing scoring artifacts per application/interview.
- `recruiter_score_jobs`: async queue for recruiter scoring.
- `interviews`: generated interview question sets and recruiter-assigned interview records.
- `idempotency_records`: request deduplication metadata for write endpoints.

## 5. End-to-end candidate user workflow

### Step 1: Sign up / sign in
1. User signs in from `app/(auth)/sign-in/page.tsx`.
2. `AuthForm` uses Firebase client auth and calls server action `signIn`.
3. Server stores session cookie and auto-provisions user profile if needed.

### Step 2: Start interview
1. User opens `/interview`.
2. `PracticeSessionBuilder` captures company profile, role, level, focus areas.
3. `Agent` sends pre-check request to `POST /api/premium/vapi-access`.
4. Backend checks:
   - Auth
   - rate limit (`checkRateLimit`)
   - premium/free-trial (`checkPremiumAccessForFeature`)
   - optional daily quota (`checkAndConsumePremiumDailyLimit`)
5. If blocked, response is `allowed: false` with explanatory message.
6. If allowed, `Agent` starts Vapi call.

### Step 3: Conduct live interview
1. Vapi emits call/message events consumed by `Agent`.
2. Transcript messages are appended and optionally emotion-analyzed.
3. Practice/job context is injected into Vapi as system/user messages.

### Step 4: End call and persist
1. On call end, `Agent` triggers `saveCallLog` (`useCallLogs.ts`).
2. `POST /api/call-logs`:
   - validates ownership + idempotency lock
   - fetches Vapi call artifacts (or uses fallback if unavailable)
   - normalizes transcript/messages/cost/status
   - writes to `callLogs`
3. If job context came from extension, auto-creates/updates `external_applications` and enqueues recruiter score job.

### Step 5: View details and feedback
1. User visits `/call-data` and `/call-data/[callId]`.
2. APIs resolve Firestore ID vs Vapi UUID and return merged data.
3. User requests feedback (`/feedback?callId=...`) or evaluation endpoints.
4. Feedback generation uses OpenRouter + deterministic guardrails.

## 6. End-to-end recruiter workflow

### Source A: CSV/manual import
1. Recruiter uses dashboard import tab.
2. `POST /api/v2/recruiter/applications/import` ingests CSV/JSON.
3. Records land in `external_applications` with normalized metadata.

### Source B: Chrome extension auto-ingestion
1. Extension scrapes job details from job page.
2. Background script opens interview URL with encoded job context.
3. Candidate takes interview.
4. Call log API auto-creates/updates `external_applications` entry and queues recruiter scoring.

### Scoring and ranking
1. Worker picks `recruiter_score_jobs` pending items.
2. Transcript fetched from Vapi or Firestore fallback.
3. OpenRouter score JSON generated + guardrails applied.
4. Score stored in `application_scores`.
5. Application updated with `scoreStatus: available`, `scoreId`.
6. Dashboard/leaderboard APIs show ranked candidates.

## 7. Key backend design patterns used

### Rate limiting
- Centralized in `lib/services/rate-limit.service.ts`.
- Per-user + global IP limits.
- Redis mode if available, in-memory fallback otherwise.

### Idempotency on writes
- `lib/services/idempotency.service.ts`.
- Used in high-value write routes (`call-logs`, recruiter status/import/assign, feedback jobs).
- Prevents duplicate writes on retries/network retries.

### Queue-based heavy processing
- Worker handles AI-heavy tasks off request path.
- Route handlers return quickly; long tasks are backgrounded.

### Guardrailed scoring
- LLM output is post-processed by deterministic guardrails.
- Prevents score inflation when transcript evidence is weak.

## 8. How frontend and backend stay in sync

- Frontend components call API routes with session cookie (`credentials: include` when needed).
- API routes derive user identity server-side from cookie (`getCurrentUser`).
- `callId` normalization pattern is used often:
  - try Firestore doc ID first
  - fallback to Vapi UUID lookup
- Cache service (`cacheService`) reduces repeated expensive operations.
- `call-data/sync` endpoint reconciles stale/in-progress call metadata.

## 9. What to say in interview when asked "architecture"

Use this short answer:
- ZenAI is a Next.js full-stack app using App Router where UI and APIs are co-located.
- Firebase handles auth/session validation and Firestore is our source of truth.
- Vapi provides real-time voice call infra, while OpenRouter powers scoring/feedback.
- We keep request paths resilient with rate limits, idempotency, retries, and caching.
- Heavy scoring workloads are async via queue collections and a background worker.
- We enforce strict evidence-based scoring with deterministic guardrails after LLM output.

## 10. Current known constraints (honest discussion points)

- Recruiter access is currently hardcoded to one email in `recruiterGuard`.
- Some endpoints still use premium gating with 402/429 semantics (except premium pre-check endpoint now returns `allowed: false` payload with 200).
- Firestore index coverage must be maintained for ordered queries at scale.
- Redis fallback to in-memory is useful in dev but should be strict in production.

## 11. Fast API map (high-value)

- Auth/session: server actions in `lib/actions/auth.actions.ts`
- Premium precheck: `POST /api/premium/vapi-access`
- Call persistence: `POST /api/call-logs`
- Candidate list/detail: `GET /api/vapi/call-data`, `GET /api/vapi/call-data/[callId]`
- Feedback (sync): `GET /api/vapi/feedback?callId=...`
- Feedback (async): `POST /api/v2/feedback-jobs`, `GET /api/v2/feedback-jobs/[jobId]`
- Recruiter dashboard: `GET /api/v2/recruiter/dashboard`
- Recruiter applications: `GET /api/v2/recruiter/applications`
- Recruiter import: `POST /api/v2/recruiter/applications/import`
- Recruiter assign: `POST /api/v2/recruiter/interview/assign`
- Recruiter leaderboard: `GET /api/v2/recruiter/leaderboard`
- Health: `GET /api/health`

---

If you are presenting this architecture tomorrow: start with identity and data flow first, then explain async scoring and guardrails as your reliability and quality differentiator.