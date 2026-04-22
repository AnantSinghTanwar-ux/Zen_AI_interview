# Backend Functions and Firestore Integration Guide (Interview Deep Dive)

## 1. Backend mental model
Think of ZenAI backend in 5 layers:

1. Identity and session
- `lib/actions/auth.actions.ts`
- Verifies Firebase session cookies and returns the current user.

2. API contract layer
- `app/api/**/route.ts`
- Validates auth, rate limits, premium access, request data.

3. Domain service layer
- `services/**` and `lib/services/**`
- Business logic for call logs, recruiter apps, feedback, queues, premium, cache, retries.

4. Data layer
- Firestore via `services/firebase/admin.ts`
- Core collections: `users`, `callLogs`, `feedback_jobs`, `external_applications`, `application_scores`, `recruiter_score_jobs`.

5. External AI/voice layer
- Vapi for live call/transcript artifacts
- OpenRouter for scoring and feedback JSON

## 2. Most important backend functions to understand

## A) Auth/session and user profile

### `setSessionCookie(idToken)`
File: `lib/actions/auth.actions.ts`
- Converts Firebase ID token to secure HTTP-only session cookie.
- Cookie key: `session`.
- Security: `httpOnly`, `sameSite=lax`, `secure` in production.

### `getCurrentUser()`
File: `lib/actions/auth.actions.ts`
- Reads and verifies `session` cookie.
- Loads Firebase user data and ensures user profile exists in Firestore.
- Returns normalized user object used by almost every API route.

### `ensureUserProfile({ uid, email, name })`
File: `lib/actions/auth.actions.ts`
- Auto-creates `users/{uid}` document if missing.
- Applies seeded premium for specific emails.

## B) Premium + free trial + daily limits

### `checkPremiumAccessForCall(...)` and `checkPremiumAccessForFeature(...)`
File: `lib/services/premium-access.service.ts`
- Core access gate used by Vapi/feedback APIs.
- Logic summary:
  - Premium users: always allowed.
  - Non-premium users: one free trial keyed by `callIds/featureKeys`.
  - After trial: blocked (`reason: upgrade-required`).

### `checkAndConsumePremiumDailyLimit(...)`
File: `lib/services/premium-access.service.ts`
- Enforces per-day premium quotas by kind:
  - `feedback`
  - `interview`
- Tracks consumed usage keys under `premiumDailyUsage`.

### `POST /api/premium/vapi-access`
File: `app/api/premium/vapi-access/route.ts`
- Preflight endpoint used before interview/chat starts.
- Checks auth, rate limit, premium access, and optional daily quota.
- Current contract:
  - success -> `allowed: true`
  - blocked -> `allowed: false` plus code/message payload
  - server failure -> 500

Important interview point:
- This endpoint is used as a UX gate so users are blocked before expensive call startup.

## C) Call log persistence and idempotency

### `saveCallLog(vapiCallId, jobContext?)` (frontend hook)
File: `hooks/useCallLogs.ts`
- Sends `POST /api/call-logs` with idempotency key:
  - `X-Idempotency-Key: call-log:{userId}:{vapiCallId}`

### `POST /api/call-logs`
File: `app/api/call-logs/route.ts`
- Critical write path after interview ends.
- Pipeline:
  1. Auth + rate limit
  2. Idempotency lock (`acquireIdempotencyLock`)
  3. Check duplicate by `vapiCallId`
  4. Fetch Vapi call details (or fallback minimal save)
  5. Normalize transcript/messages/cost fields
  6. Save in `callLogs`
  7. If extension job context exists -> create/update recruiter application + enqueue recruiter scoring job

### Why idempotency matters here
- Call-end events can fire multiple times or users can retry due flaky network.
- Idempotency guarantees one logical write.

## D) Feedback and evaluation generation

### `GET /api/vapi/feedback?callId=...`
File: `app/api/vapi/feedback/route.ts`
- Resolves Firestore doc ID vs Vapi UUID.
- Enforces premium access and premium daily feedback quota.
- Uses cache key `feedback:v2:{callId}`.
- Fetches transcript from Vapi, falls back to Firestore.
- Generates feedback with OpenRouter and applies guardrails.

### `POST /api/vapi/call-data/[callId]/evaluation`
File: `app/api/vapi/call-data/[callId]/evaluation/route.ts`
- Strict structured interview evaluation (aspect scores + recommendation).
- Uses `interviewEvaluationService.evaluateInterview`.

### `generateOpenRouterJson<T>(...)`
File: `services/ai/openrouter-client.ts`
- Shared helper that:
  - tries model candidates in order
  - retries transient failures
  - extracts/parses JSON from model response

## E) Async queue processing

### Feedback queue API
Files:
- `app/api/v2/feedback-jobs/route.ts`
- `app/api/v2/feedback-jobs/[jobId]/route.ts`

Behavior:
- `POST /api/v2/feedback-jobs` creates pending job (deduplicates by callId+userId+status).
- Worker picks pending jobs and writes `completed` with generated feedback.
- Client polls single job endpoint for status.

### Worker process
File: `services/feedback/feedback-worker.ts`
- Polls every 5s.
- Processes:
  - `feedback_jobs`
  - `recruiter_score_jobs`
- Retry behavior with capped retries and status transitions.

## F) Recruiter scoring pipeline

### `enqueueRecruiterScoreJob(...)`
File: `services/recruiter/recruiter-score-queue.service.ts`
- Inserts into `recruiter_score_jobs` with dedupe.
- Marks related application `scoreStatus: processing`.

### `processRecruiterScoreJob(...)`
File: `services/recruiter/recruiter-score-queue.service.ts`
- Pulls transcript (Vapi first, Firestore fallback).
- Runs strict recruiter prompt via OpenRouter.
- Applies recruiter guardrails.
- Saves to `application_scores`.
- Updates `external_applications` to `scoreStatus: available`.

## G) Call data APIs consumed by frontend

### `GET /api/vapi/call-data`
File: `app/api/vapi/call-data/route.ts`
- Lists current user call logs with premium gate.
- Performs bounded live sync for stale/in-progress calls.

### `GET /api/vapi/call-data/[callId]`
File: `app/api/vapi/call-data/[callId]/route.ts`
- Returns detailed call + message timeline + emotion overlays.
- Handles Firestore ID and Vapi UUID interoperability.

## 3. Firestore schema and key attributes

## `users` document (key: `uid`)
Important fields:
- `name`, `email`, `userType`
- `isPremium`, `premiumSource`, `premiumGrantedAt`
- `freeTrialUsed`, `freeTrialUsedAt`
- `freeTrialCallIds` (array)
- `premiumDailyUsage`:
  - `date`
  - `feedbackKeys[]`
  - `interviewKeys[]`

## `callLogs`
Important fields:
- `userId`
- `vapiCallId`
- `status`, `startedAt`, `endedAt`, `duration`
- `cost`, `costBreakdown`
- `messageCount`, `hasRecording`, `hasTranscript`
- `transcript`, `summary`, `analysis`
- `createdAt`, `updatedAt`

## `feedback_jobs`
Important fields:
- `userId`, `callId`
- `status`: `pending | processing | completed | failed`
- `retryCount`, `error`
- `feedback` (final payload)
- `processingTimeMs`, `modelUsed`
- `createdAt`, `startedAt`, `completedAt`

## `external_applications`
Important fields:
- Candidate: `candidateName`, `candidateEmail`, `candidateUserId`
- Job source: `sourcePlatform`, `externalJobId`, `externalJobUrl`
- Role: `companyName`, `roleTitle`, `roleCategory`
- Interview: `interviewId`, `interviewStatus`, `inviteLink`
- Score: `scoreStatus`, `scoreId`
- Pipeline status: `status`
- Ownership: `recruiterOwnerId`
- Timestamps: `createdAt`, `updatedAt`

## `application_scores`
Important fields:
- `applicationId`, `interviewId`
- `overallScore`, `technicalScore`, `communicationScore`, `problemSolvingScore`
- `recommendation` (`strong_hire|hire|maybe|no_hire`)
- `strengths`, `weaknesses`, `feedbackSummary`
- `generatedBy`, `createdAt`

## `recruiter_score_jobs`
Important fields:
- `applicationId`, `interviewId`
- `status`, `retryCount`, `error`
- `scoreId`, `modelUsed`, `processingTimeMs`
- `createdAt`, `startedAt`, `completedAt`

## 4. How frontend and backend work together (important for interview)

## Flow 1: interview start
Frontend:
- `components/Agent.tsx` calls `POST /api/premium/vapi-access`.
Backend:
- validates session/premium/quota and returns `allowed`.
Result:
- If `allowed`, frontend starts Vapi call.

## Flow 2: interview end -> persistent record
Frontend:
- `useCallLogs.saveCallLog(vapiCallId)`.
Backend:
- `POST /api/call-logs` fetches Vapi details and persists normalized log.
Result:
- call appears in `/call-data` list and can be analyzed.

## Flow 3: feedback generation
Frontend:
- Feedback page requests call feedback endpoint.
Backend:
- resolves transcript, runs OpenRouter analysis, applies guardrails, caches output.
Result:
- User sees score breakdown + suggestions.

## Flow 4: recruiter ranking
Frontend:
- Recruiter dashboard polls applications and leaderboard APIs.
Backend:
- worker asynchronously computes score from transcripts.
Result:
- recruiter sees ranked candidate list and statuses.

## 5. Reliability and scaling mechanisms in code

- Rate limiting: `checkRateLimit` with per-user + IP global checks.
- Idempotency: `idempotency_records` lock flow for write endpoints.
- Caching: Redis-backed cache service with fallback.
- Retries: `retryWithBackoff` around AI calls.
- Async jobs: worker for expensive scoring tasks.
- Guardrails: deterministic score caps to avoid hallucinated high scoring.

## 6. What to emphasize if interviewer asks "backend complexity"

Strong answer:
- "Our backend is not just CRUD; it has access control, premium entitlements, idempotent write guarantees, async job orchestration, and deterministic post-AI validation."

Concrete evidence you can cite:
- Premium entitlement state machine (`freeTrialUsed`, `freeTrialCallIds`, daily usage keys)
- Idempotency in `POST /api/call-logs` and recruiter writes
- Queue-backed worker (`feedback_jobs`, `recruiter_score_jobs`)
- Guardrail layer after LLM inference

## 7. Common interview questions with prepared answers

Q: How do you prevent duplicate write bugs?
A: We use idempotency keys and a Firestore-backed idempotency record state machine (`processing/replay/completed/failed`) for high-value POST/PATCH endpoints.

Q: How do you control cost and latency for AI calls?
A: We cache expensive outputs, retry only transient errors, and push heavy scoring into background workers.

Q: How do you ensure secure data isolation per user?
A: Every API reads user from validated session cookie and scopes queries by `user.id`; unauthorized users get 401/403.

Q: How do Firestore and frontend stay consistent when IDs differ?
A: APIs resolve call identifiers both as Firestore doc IDs and Vapi UUIDs before fetching details, so frontend links remain stable.

Q: How do you avoid inflated AI scores?
A: Prompt constraints plus deterministic guardrail post-processing enforce evidence-based caps on technical/problem-solving scores.

## 8. 60-second backend pitch you can memorize
"ZenAI backend is a Next.js API layer on top of Firebase Auth + Firestore, with Vapi for voice artifacts and OpenRouter for scoring. Every critical route enforces session auth, rate limits, and premium checks. We persist interview artifacts through an idempotent call-log endpoint, then run strict analysis either synchronously for immediate feedback or asynchronously via queue workers for heavy recruiter scoring. The async worker updates score collections and recruiter dashboards. We also apply deterministic guardrails after model inference to keep scoring evidence-based and production-safe."
