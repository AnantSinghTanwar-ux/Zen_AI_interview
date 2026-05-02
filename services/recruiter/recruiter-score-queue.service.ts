import { db } from "@/services/firebase/admin";
import { callLogService } from "@/services/firebase/call-log.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { saveScore, getScoreByApplication } from "@/services/recruiter/application-score.service";
import { updateApplicationScoreState } from "@/services/recruiter/external-application.service";
import {
  generateOpenRouterJson,
  getOpenRouterModelCandidates,
  hasOpenRouterKey,
} from "@/services/ai/openrouter-client";
import {
  analyzeTranscriptEvidence,
  applyRecruiterScoreGuardrails,
} from "@/services/ai/analysis-guardrails";

const COLLECTION = "recruiter_score_jobs";
const MAX_RETRIES = Number(process.env.RECRUITER_SCORE_JOB_MAX_RETRIES ?? 3);
const TRANSCRIPT_FETCH_ATTEMPTS = Number(process.env.RECRUITER_TRANSCRIPT_FETCH_ATTEMPTS ?? 3);
const TRANSCRIPT_FETCH_DELAY_MS = Number(process.env.RECRUITER_TRANSCRIPT_FETCH_DELAY_MS ?? 1500);
const MIN_TRANSCRIPT_LENGTH = Number(process.env.RECRUITER_MIN_TRANSCRIPT_LENGTH ?? 50);
const MIN_CANDIDATE_WORDS = Number(process.env.RECRUITER_MIN_CANDIDATE_WORDS ?? 15);
const MIN_CANDIDATE_TURNS = Number(process.env.RECRUITER_MIN_CANDIDATE_TURNS ?? 2);

const SCORE_MODEL_CANDIDATES = getOpenRouterModelCandidates(
  process.env.OPENROUTER_RECRUITER_STRICT_MODEL,
  // Valid OpenRouter model IDs — claude-sonnet-4 does NOT exist on OpenRouter
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-haiku",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  process.env.OPENROUTER_HARSH_ANALYSIS_MODEL,
  process.env.OPENROUTER_EVALUATION_MODEL,
  process.env.OPENROUTER_MODEL,
  "openrouter/auto"
);

export type RecruiterScoreJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

interface RecruiterScoreJob {
  applicationId: string;
  interviewId: string;
  status: RecruiterScoreJobStatus;
  retryCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  scoreId: string | null;
  modelUsed: string | null;
  processingTimeMs: number;
  error: string | null;
}

function isMissingIndexError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error || "");
  const code = (error as { code?: unknown })?.code;

  return (
    code === 9 ||
    code === "failed-precondition" ||
    message.includes("FAILED_PRECONDITION") ||
    message.toLowerCase().includes("index")
  );
}

async function getPendingScoreJobSnapshot(safeLimit: number) {
  try {
    return await db
      .collection(COLLECTION)
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .limit(safeLimit)
      .get();
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    console.warn(
      "[ScoreQueue] Missing Firestore index for pending score jobs query, using in-memory fallback sort."
    );

    const fallbackSize = Math.max(100, safeLimit * 5);
    const fallbackSnapshot = await db
      .collection(COLLECTION)
      .where("status", "==", "pending")
      .limit(fallbackSize)
      .get();

    const sortedDocs = [...fallbackSnapshot.docs].sort((a, b) => {
      const aMillis = new Date(String(a.data()?.createdAt || "")).getTime();
      const bMillis = new Date(String(b.data()?.createdAt || "")).getTime();
      return (Number.isFinite(aMillis) ? aMillis : 0) - (Number.isFinite(bMillis) ? bMillis : 0);
    });

    return {
      empty: sortedDocs.length === 0,
      docs: sortedDocs.slice(0, safeLimit),
    };
  }
}

function buildTranscriptFromMessages(messages: any[]): string {
  return (messages as any[])
    .filter((msg: any) => {
      if (msg.type === "transcript" && msg.transcriptType === "final") return true;
      if (
        (msg.role === "user" ||
          msg.role === "assistant" ||
          msg.role === "bot" ||
          msg.role === "human" ||
          msg.role === "candidate") &&
        (msg.content || msg.message || msg.transcript)
      ) {
        return true;
      }
      return false;
    })
    .map((msg: any) => {
      const roleValue = String(msg.role || "").toLowerCase();
      const role =
        roleValue === "user" || roleValue === "human" || roleValue === "candidate"
          ? "Candidate"
          : "Interviewer";
      const content = msg.transcript || msg.content || msg.message || "";
      return `${role}: ${content}`;
    })
    .join("\n")
    .trim();
}

function buildTranscriptFromCallData(callData: any): string {
  const messages = callData?.artifact?.messages || callData?.messages || [];
  const transcriptFromMessages = buildTranscriptFromMessages(messages);

  if (
    transcriptFromMessages.length >= 50 &&
    /(^|\n)\s*Candidate\s*:/i.test(transcriptFromMessages)
  ) {
    return transcriptFromMessages;
  }

  const artifactTranscript =
    typeof callData?.artifact?.transcript === "string"
      ? String(callData.artifact.transcript)
        .trim()
      : "";

  if (artifactTranscript.length >= 50) {
    return artifactTranscript;
  }

  return transcriptFromMessages;
}

function isTranscriptReadyForScoring(transcript: string): boolean {
  const normalized = String(transcript || "").trim();
  if (normalized.length < MIN_TRANSCRIPT_LENGTH) {
    return false;
  }

  const evidence = analyzeTranscriptEvidence(normalized);
  if (evidence.candidateTurns < MIN_CANDIDATE_TURNS) {
    return false;
  }

  if (evidence.candidateWordCount < MIN_CANDIDATE_WORDS) {
    return false;
  }

  return true;
}

async function getTranscript(interviewId: string): Promise<string> {
  let bestTranscript = "";

  try {
    const callData = await vapiCallDataService.getCall(interviewId);
    const transcript = buildTranscriptFromCallData(callData);
    if (transcript.trim().length > bestTranscript.length) {
      bestTranscript = transcript.trim();
    }
  } catch {
    // fall through to Firestore fallback
  }

  const logByVapiId = await callLogService.getCallLogByVapiId(interviewId).catch(() => null);
  const fromVapiLog =
    typeof (logByVapiId as any)?.transcript === "string"
      ? String((logByVapiId as any).transcript)
      : "";
  if (fromVapiLog.trim().length > bestTranscript.length) {
    bestTranscript = fromVapiLog.trim();
  }

  const logByDocId = await callLogService.getCallLogById(interviewId).catch(() => null);
  const fromDocLog =
    typeof (logByDocId as any)?.transcript === "string"
      ? String((logByDocId as any).transcript)
      : "";

  if (fromDocLog.trim().length > bestTranscript.length) {
    bestTranscript = fromDocLog.trim();
  }

  return bestTranscript;
}

async function getTranscriptWithRetries(interviewId: string): Promise<string> {
  const attempts = Number.isFinite(TRANSCRIPT_FETCH_ATTEMPTS)
    ? Math.min(5, Math.max(1, Math.floor(TRANSCRIPT_FETCH_ATTEMPTS)))
    : 3;
  const delayMs = Number.isFinite(TRANSCRIPT_FETCH_DELAY_MS)
    ? Math.max(200, Math.floor(TRANSCRIPT_FETCH_DELAY_MS))
    : 1500;

  let bestTranscript = "";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const transcript = await getTranscript(interviewId);

    if (transcript.trim().length > bestTranscript.length) {
      bestTranscript = transcript.trim();
    }

    if (isTranscriptReadyForScoring(transcript)) {
      return transcript;
    }

    if (attempt < attempts) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return bestTranscript;
}

function buildRecruiterPrompt(transcript: string): string {
  const normalizedTranscript = String(transcript || "")
    .replace(/\r\n?/g, "\n")
    .trim();

  return `
You are a ruthlessly strict senior technical hiring evaluator. You evaluate candidates the way a top-tier company (Google, Meta, Stripe) would. Your scoring must be HARSH and EVIDENCE-BASED.

## ZERO-TOLERANCE RULES (MUST FOLLOW):
1. If the candidate says "I don't know", "I'm not sure", "no idea", "skip", or gives empty/silence responses to technical questions → that question scores 0. Aggregate accordingly.
2. If the candidate answered fewer than 3 technical questions substantively → technicalScore MUST be ≤ 15.
3. If the candidate never walked through a problem-solving approach → problemSolvingScore MUST be ≤ 10.
4. Politeness, greetings, and filler ("that's a great question", "thank you for asking") contribute ZERO to any score. Only substantive technical/analytical content counts.
5. Mentioning resume, background, or past experience without demonstrating actual knowledge = 0 technical credit for that response.
6. One-word or two-word answers ("yes", "no", "maybe", "I think so") = 0 credit per response.
7. If the candidate's total substantive content is under 50 words across the entire interview → ALL scores MUST be ≤ 10.

## SCORING BANDS (interpret strictly):

**Technical Score (0-100):**
- 0-5: Candidate said nothing technical, or only said "I don't know"
- 6-15: Mentioned 1-2 technical terms but zero depth or explanation
- 16-30: Some technical awareness but mostly wrong, vague, or surface-level
- 31-50: Partial technical knowledge with significant gaps
- 51-70: Solid understanding with correct explanations on most topics
- 71-85: Strong depth, accurate terminology, good examples
- 86-100: Expert-level mastery rarely seen in interviews

**Communication Score (0-100):**
- 0-5: Silent, incoherent, or only monosyllabic responses
- 6-15: Barely communicative, no structure, hard to follow
- 16-30: Can form sentences but disorganized and unfocused
- 31-50: Understandable but lacks clarity and structure
- 51-70: Clear communication with reasonable structure
- 71-85: Well-articulated, structured, persuasive
- 86-100: Exceptionally clear, concise, and compelling

**Problem Solving Score (0-100):**
- 0-5: No problem-solving demonstrated whatsoever
- 6-15: Made an attempt but completely wrong or no methodology
- 16-30: Some analytical thought but missed critical aspects
- 31-50: Reasonable approach with notable weaknesses
- 51-70: Good systematic thinking with trade-off awareness
- 71-85: Strong analytical skills with edge case consideration
- 86-100: Exceptional decomposition with creative solutions

## SCORING METHODOLOGY:
1. List every question the interviewer asked.
2. For each question, classify the candidate's response as: STRONG (full, correct, detailed), PARTIAL (some correct content), WEAK (mostly wrong/vague), or EMPTY (no answer, "I don't know", silence).
3. Count: X STRONG, Y PARTIAL, Z WEAK, W EMPTY out of N total questions.
4. technicalScore should roughly correlate to: (STRONG*100 + PARTIAL*50 + WEAK*15 + EMPTY*0) / N
5. Apply similar logic for problemSolvingScore and communicationScore.

## OVERALL SCORE CALCULATION:
Overall = Technical(40%) + ProblemSolving(30%) + Communication(30%)
Adjust -3 to -5 for red flags (dishonesty, arrogance, deflection).
Adjust +1 to +3 only for genuinely impressive depth beyond expectations.

## RECOMMENDATION:
- strong_hire (85+): Exceptional — would strengthen any team. Very rare.
- hire (65-84): Clearly meets the bar for the role.
- maybe (40-64): Mixed — some promise but real concerns.
- no_hire (0-39): Does NOT meet the hiring bar.

## SPECIAL HANDLING:
- Very short interview (<5 candidate responses): This is a NEGATIVE signal. Default to low scores (≤20) unless every single response was technically brilliant.
- Candidate mostly says "I don't know" or equivalent: ALL scores should be ≤ 10. This is a failed interview.
- Generic/vague responses without specifics: Score ≤ 25 in relevant dimensions.
- If the candidate had clear technical issues (audio problems, disconnects): note in feedbackSummary but do NOT inflate scores for content that wasn't delivered.

## TRANSCRIPT TO ANALYZE:
${normalizedTranscript}

## REQUIRED OUTPUT (ONLY valid JSON):
{
  "overallScore": <number 0-100>,
  "technicalScore": <number 0-100>,
  "communicationScore": <number 0-100>,
  "problemSolvingScore": <number 0-100>,
  "recommendation": "<one of: strong_hire, hire, maybe, no_hire>",
  "strengths": ["<specific observed strength>", "<another if applicable>"],
  "weaknesses": ["<specific observed weakness>", "<another weakness>"],
  "feedbackSummary": "<3-4 sentences with SPECIFIC quotes/paraphrases from the transcript. What exactly did the candidate say that was good or bad? Generic feedback is FORBIDDEN.>"
}

CRITICAL REMINDERS:
- Default stance is SKEPTICAL. Assume mediocre until proven otherwise.
- feedbackSummary MUST quote or paraphrase actual candidate responses. "The candidate performed adequately" is UNACCEPTABLE.
- A candidate who says "I don't know" to most questions CANNOT score above 10 in technical or problem-solving.
- Differentiate between candidates. Two different interviews should virtually NEVER produce the same scores.

Return ONLY the JSON object.
`;
}


export async function enqueueRecruiterScoreJob(params: {
  applicationId: string;
  interviewId: string;
}): Promise<{ jobId: string; status: RecruiterScoreJobStatus; deduplicated: boolean }> {
  const applicationId = String(params.applicationId || "").trim();
  const interviewId = String(params.interviewId || "").trim();

  if (!applicationId || !interviewId) {
    throw new Error("applicationId and interviewId are required");
  }

  const existing = await db
    .collection(COLLECTION)
    .where("applicationId", "==", applicationId)
    .where("interviewId", "==", interviewId)
    .where("status", "in", ["pending", "processing", "completed"])
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    return {
      jobId: doc.id,
      status: (doc.data().status || "pending") as RecruiterScoreJobStatus,
      deduplicated: true,
    };
  }

  const now = new Date().toISOString();
  const payload: RecruiterScoreJob = {
    applicationId,
    interviewId,
    status: "pending",
    retryCount: 0,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    scoreId: null,
    modelUsed: null,
    processingTimeMs: 0,
    error: null,
  };

  const ref = await db.collection(COLLECTION).add(payload);

  await updateApplicationScoreState(applicationId, {
    scoreStatus: "pending",
  }).catch(() => {
    // Queue creation should still succeed even if status update fails.
  });

  return {
    jobId: ref.id,
    status: "pending",
    deduplicated: false,
  };
}

/**
 * Enqueue a score job and immediately start processing it in the background
 * (fire-and-forget). This ensures scoring happens right after an interview ends
 * without requiring a separate cron or manual trigger.
 */
export function enqueueAndProcessRecruiterScoreJob(params: {
  applicationId: string;
  interviewId: string;
}): void {
  enqueueRecruiterScoreJob(params)
    .then(({ jobId, deduplicated }) => {
      if (!deduplicated) {
        // Run the job immediately in the background — don't await
        processRecruiterScoreJob(jobId, {
          applicationId: params.applicationId,
          interviewId: params.interviewId,
          status: "pending",
          retryCount: 0,
          createdAt: new Date().toISOString(),
          startedAt: null,
          completedAt: null,
          scoreId: null,
          modelUsed: null,
          processingTimeMs: 0,
          error: null,
        }).catch((err) => {
          console.error("[AutoScore] Background processing failed for job", jobId, err);
        });
      }
    })
    .catch((err) => {
      console.error("[AutoScore] Failed to enqueue score job:", err);
    });
}

async function completeRecruiterScoreJob(params: {
  jobId: string;
  scoreId: string;
  modelUsed: string;
  processingTimeMs: number;
}) {
  const now = new Date().toISOString();
  await db.collection(COLLECTION).doc(params.jobId).update({
    status: "completed",
    scoreId: params.scoreId,
    modelUsed: params.modelUsed,
    processingTimeMs: params.processingTimeMs,
    completedAt: now,
    error: null,
  });
}

async function failRecruiterScoreJob(params: {
  jobId: string;
  retryCount: number;
  error: unknown;
  exhausted: boolean;
}) {
  await db.collection(COLLECTION).doc(params.jobId).update({
    status: params.exhausted ? "failed" : "pending",
    retryCount: params.retryCount,
    error:
      params.error instanceof Error
        ? params.error.message
        : String(params.error || "Failed to process recruiter score job"),
  });
}

export async function processRecruiterScoreJob(jobId: string, job: RecruiterScoreJob) {
  const start = Date.now();

  try {
    await db.collection(COLLECTION).doc(jobId).update({
      status: "processing",
      startedAt: new Date().toISOString(),
    });

    await updateApplicationScoreState(job.applicationId, {
      scoreStatus: "processing",
    }).catch(() => {
      // no-op
    });

    const existingScore = await getScoreByApplication(job.applicationId);
    if (existingScore) {
      await updateApplicationScoreState(job.applicationId, {
        scoreStatus: "available",
        scoreId: existingScore.id,
      });

      await completeRecruiterScoreJob({
        jobId,
        scoreId: existingScore.id,
        modelUsed: String(existingScore.generatedBy || "cached"),
        processingTimeMs: Date.now() - start,
      });
      return;
    }

    if (!hasOpenRouterKey()) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const transcript = await getTranscriptWithRetries(job.interviewId);
    if (!isTranscriptReadyForScoring(transcript)) {
      const evidence = analyzeTranscriptEvidence(transcript);
      throw new Error(
        `Transcript not ready for scoring yet (candidateTurns=${evidence.candidateTurns}, candidateWords=${evidence.candidateWordCount}, interviewerTurns=${evidence.interviewerTurns})`
      );
    }

    const rawScore = await generateOpenRouterJson<any>({
      prompt: buildRecruiterPrompt(transcript),
      modelCandidates: SCORE_MODEL_CANDIDATES,
      temperature: 0,
      maxTokens: 2_500,
    });

    const guarded = applyRecruiterScoreGuardrails(rawScore, transcript);

    const scoreId = await saveScore({
      applicationId: job.applicationId,
      interviewId: job.interviewId,
      overallScore: Math.min(100, Math.max(0, guarded.overallScore || 0)),
      technicalScore: Math.min(100, Math.max(0, guarded.technicalScore || 0)),
      communicationScore: Math.min(100, Math.max(0, guarded.communicationScore || 0)),
      problemSolvingScore: Math.min(100, Math.max(0, guarded.problemSolvingScore || 0)),
      recommendation: guarded.recommendation || "maybe",
      strengths: guarded.strengths || [],
      weaknesses: guarded.weaknesses || [],
      feedbackSummary: guarded.feedbackSummary || "",
      generatedBy: "openrouter" as any,
    }, {
      scoringVersion: "recruiter-strict-v3",
      modelCandidates: SCORE_MODEL_CANDIDATES,
    });

    await updateApplicationScoreState(job.applicationId, {
      scoreStatus: "available",
      scoreId,
    });

    await completeRecruiterScoreJob({
      jobId,
      scoreId,
      modelUsed: SCORE_MODEL_CANDIDATES[0] || "openrouter/auto",
      processingTimeMs: Date.now() - start,
    });
  } catch (error) {
    const nextRetryCount = Number(job.retryCount || 0) + 1;
    const exhausted = nextRetryCount >= MAX_RETRIES;

    await failRecruiterScoreJob({
      jobId,
      retryCount: nextRetryCount,
      error,
      exhausted,
    });

    if (exhausted) {
      await updateApplicationScoreState(job.applicationId, {
        scoreStatus: "failed",
      }).catch(() => {
        // no-op
      });
    } else {
      await updateApplicationScoreState(job.applicationId, {
        scoreStatus: "pending",
      }).catch(() => {
        // no-op
      });
    }
  }
}

export async function processPendingRecruiterScoreJobs(limit: number = 5) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 20) : 5;

  const snapshot = await getPendingScoreJobSnapshot(safeLimit);

  if (snapshot.empty) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    try {
      // Cap each individual job to 90s to prevent serverless timeout
      await Promise.race([
        processRecruiterScoreJob(doc.id, doc.data() as RecruiterScoreJob),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Job timeout after 90s")), 90_000)
        ),
      ]);
      processed++;
    } catch (err) {
      console.error(`[ScoreQueue] Job ${doc.id} timed out or failed:`, err);
      failed++;
      // Mark as failed so it doesn't block the queue
      await db.collection(COLLECTION).doc(doc.id).update({
        status: "failed",
        error: err instanceof Error ? err.message : "Job timed out",
      }).catch(() => {/* no-op */});

      const jobData = doc.data() as RecruiterScoreJob;
      await updateApplicationScoreState(jobData.applicationId, {
        scoreStatus: "failed",
      }).catch(() => {
        // no-op
      });
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }

  return { processed, failed };
}

export async function enqueueRecruiterScoreBackfillJobs(apps: Array<{
  id: string;
  interviewId?: string;
  interviewStatus?: string;
  scoreStatus?: string;
}>) {
  const candidates: Array<{ id: string; interviewId?: string }> = [];

  for (const app of apps) {
    if (app.interviewStatus !== "completed" || !app.interviewId) {
      continue;
    }

    if (app.scoreStatus !== "available") {
      candidates.push(app);
      continue;
    }

    const existingScore = await getScoreByApplication(app.id).catch(() => null);
    if (!existingScore) {
      candidates.push(app);
    }

    if (candidates.length >= 20) {
      break;
    }
  }

  for (const app of candidates.slice(0, 20)) {
    await enqueueRecruiterScoreJob({
      applicationId: app.id,
      interviewId: String(app.interviewId),
    }).catch(() => {
      // no-op for dashboard backfill enqueue
    });
  }
}

export async function getRecruiterScoreQueueMetrics() {
  const [pending, processing, completed, failed] = await Promise.all([
    db.collection(COLLECTION).where("status", "==", "pending").get(),
    db.collection(COLLECTION).where("status", "==", "processing").get(),
    db.collection(COLLECTION).where("status", "==", "completed").get(),
    db.collection(COLLECTION).where("status", "==", "failed").get(),
  ]);

  return {
    pending: pending.size,
    processing: processing.size,
    completed: completed.size,
    failed: failed.size,
  };
}
