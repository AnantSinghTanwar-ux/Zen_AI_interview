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
import { applyRecruiterScoreGuardrails } from "@/services/ai/analysis-guardrails";

const COLLECTION = "recruiter_score_jobs";
const MAX_RETRIES = Number(process.env.RECRUITER_SCORE_JOB_MAX_RETRIES ?? 3);

const SCORE_MODEL_CANDIDATES = getOpenRouterModelCandidates(
  process.env.OPENROUTER_RECRUITER_STRICT_MODEL,
  "anthropic/claude-sonnet-4",
  "anthropic/claude-3.7-sonnet",
  "openai/gpt-4.1",
  "google/gemini-2.5-pro-preview-06-05",
  process.env.OPENROUTER_HARSH_ANALYSIS_MODEL,
  process.env.OPENROUTER_EVALUATION_MODEL,
  "openai/gpt-4.1-mini",
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

function buildTranscriptFromCallData(callData: any): string {
  const artifactTranscript =
    typeof callData?.artifact?.transcript === "string"
      ? String(callData.artifact.transcript)
      : "";

  if (artifactTranscript.trim().length >= 50) {
    return artifactTranscript.trim();
  }

  const messages = callData?.artifact?.messages || callData?.messages || [];

  return (messages as any[])
    .filter((msg: any) => {
      if (msg.type === "transcript" && msg.transcriptType === "final") return true;
      if (
        (msg.role === "user" || msg.role === "assistant" || msg.role === "bot") &&
        (msg.content || msg.message || msg.transcript)
      )
        return true;
      return false;
    })
    .map((msg: any) => {
      const role = msg.role === "user" ? "Candidate" : "Interviewer";
      const content = msg.transcript || msg.content || msg.message || "";
      return `${role}: ${content}`;
    })
    .join("\n");
}

async function getTranscript(interviewId: string): Promise<string> {
  try {
    const callData = await vapiCallDataService.getCall(interviewId);
    const transcript = buildTranscriptFromCallData(callData);
    if (transcript.trim().length >= 50) {
      return transcript;
    }
  } catch {
    // fall through to Firestore fallback
  }

  const logByVapiId = await callLogService.getCallLogByVapiId(interviewId).catch(() => null);
  const fromVapiLog =
    typeof (logByVapiId as any)?.transcript === "string"
      ? String((logByVapiId as any).transcript)
      : "";
  if (fromVapiLog.trim().length >= 50) {
    return fromVapiLog;
  }

  const logByDocId = await callLogService.getCallLogById(interviewId).catch(() => null);
  const fromDocLog =
    typeof (logByDocId as any)?.transcript === "string"
      ? String((logByDocId as any).transcript)
      : "";

  return fromDocLog;
}

function buildRecruiterPrompt(transcript: string): string {
  const normalizedTranscript = String(transcript || "")
    .replace(/\r\n?/g, "\n")
    .trim();

  return `
You are a senior technical recruiter and hiring panel evaluator. Your job is to produce a PRECISE, DIFFERENTIATED score for this specific candidate interview.

CRITICAL: Every candidate is different. Scores MUST reflect actual performance differences. Two candidates should NEVER get the same score unless their interviews are virtually identical.

## ANALYSIS METHODOLOGY (Follow step-by-step)

### Step 1: Extract Question-Answer Pairs
Identify every distinct question or topic the interviewer raised. For each one, note:
- The specific question or topic
- What the candidate actually said in response
- Whether the response was: correct, partially correct, incorrect, vague, or missing

### Step 2: Score Each Dimension Independently

**Technical Score (0-100):**
- Did the candidate demonstrate specific technical knowledge?
- Were technical terms used correctly?
- Did they explain concepts with depth (not just name-dropping)?
- Were code examples, architecture decisions, or algorithms discussed accurately?
- Score 0-15: No technical content or all wrong
- Score 16-35: Mentioned tech topics but shallow/incorrect
- Score 36-55: Some correct technical knowledge, major gaps
- Score 56-75: Solid technical understanding with minor gaps
- Score 76-90: Strong technical depth, mostly accurate
- Score 91-100: Exceptional, expert-level technical discourse

**Communication Score (0-100):**
- Were answers clear, structured, and well-articulated?
- Did the candidate explain their thought process?
- Were responses concise yet comprehensive?
- Did they ask clarifying questions when appropriate?
- Score 0-15: Incoherent, silent, or one-word answers
- Score 16-35: Disorganized, hard to follow
- Score 36-55: Understandable but rambling or unfocused
- Score 56-75: Clear communication with some structure
- Score 76-90: Well-structured, articulate responses
- Score 91-100: Exceptional clarity and persuasiveness

**Problem Solving Score (0-100):**
- Did the candidate break down problems systematically?
- Did they consider edge cases or trade-offs?
- Did they demonstrate analytical thinking?
- Did they walk through their approach before implementing?
- Score 0-15: No problem-solving demonstrated
- Score 16-35: Jumped to conclusions without analysis
- Score 36-55: Some analytical thinking, missed key aspects
- Score 56-75: Good approach with reasonable trade-off analysis
- Score 76-90: Excellent systematic problem breakdown
- Score 91-100: Masterful problem decomposition with creative solutions

### Step 3: Calculate Overall Score
Overall = weighted average:
- Technical: 40%
- Problem Solving: 30%
- Communication: 30%

Then adjust ±5 points based on:
- Enthusiasm and engagement (+1 to +3)
- Red flags like dishonesty or arrogance (-3 to -5)
- Consistency across topics (+1 to +2)

### Step 4: Determine Recommendation
- strong_hire (85-100): Exceptional across all dimensions, would strengthen any team
- hire (65-84): Solid performer, clearly meets the bar for the role
- maybe (40-64): Mixed signals, some promise but significant concerns
- no_hire (0-39): Does not meet the hiring bar

## SPECIAL CASES:
- Very short interviews (< 5 exchanges): Score based on what IS there, but note this in feedbackSummary. Short does NOT mean automatic zero - a candidate who gives 3 brilliant answers deserves a good score.
- If candidate gives mostly irrelevant answers: communicationScore should still reflect clarity of speech, but technicalScore and problemSolvingScore should be very low.
- If transcript shows candidate was interrupted or had technical issues: note this and be fair.

## TRANSCRIPT TO ANALYZE:
${normalizedTranscript}

## REQUIRED OUTPUT FORMAT (ONLY valid JSON, nothing else):
{
  "overallScore": <number 0-100>,
  "technicalScore": <number 0-100>,
  "communicationScore": <number 0-100>,
  "problemSolvingScore": <number 0-100>,
  "recommendation": "<one of: strong_hire, hire, maybe, no_hire>",
  "strengths": ["<specific strength from transcript>", "<another specific strength>", "<third strength if applicable>"],
  "weaknesses": ["<specific weakness from transcript>", "<another specific weakness>"],
  "feedbackSummary": "<3-4 sentence detailed assessment referencing specific parts of the interview, what impressed you, what concerned you, and why you gave this particular score>"
}

IMPORTANT: The feedbackSummary MUST reference specific things the candidate said. Generic feedback like "candidate performed adequately" is UNACCEPTABLE. Quote or paraphrase actual responses.

Return ONLY the JSON object, no additional text.
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
    scoreStatus: "processing",
  }).catch(() => {
    // Queue creation should still succeed even if status update fails.
  });

  return {
    jobId: ref.id,
    status: "pending",
    deduplicated: false,
  };
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

    const transcript = await getTranscript(job.interviewId);

    const rawScore =
      !transcript || transcript.trim().length < 20
        ? {
            overallScore: 0,
            technicalScore: 0,
            communicationScore: 4,
            problemSolvingScore: 0,
            recommendation: "no_hire",
            strengths: [],
            weaknesses: [
              "No meaningful candidate response found in transcript",
            ],
            feedbackSummary:
              "Candidate provided little or no usable response during the interview.",
          }
        : await generateOpenRouterJson<any>({
            prompt: buildRecruiterPrompt(transcript),
            modelCandidates: SCORE_MODEL_CANDIDATES,
            temperature: 0.1,
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
      scoringVersion: "recruiter-strict-v2",
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
    }
  }
}

export async function processPendingRecruiterScoreJobs(limit: number = 5) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 20) : 5;

  const snapshot = await db
    .collection(COLLECTION)
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .limit(safeLimit)
    .get();

  if (snapshot.empty) return;

  for (const doc of snapshot.docs) {
    await processRecruiterScoreJob(doc.id, doc.data() as RecruiterScoreJob);
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
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
