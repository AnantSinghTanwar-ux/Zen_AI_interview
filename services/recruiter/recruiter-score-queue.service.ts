import { db } from "@/services/firebase/admin";
import { callLogService } from "@/services/firebase/call-log.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { saveScore, getScoreByApplication } from "@/services/recruiter/application-score.service";
import { updateApplicationStatus } from "@/services/recruiter/external-application.service";
import {
  generateOpenRouterJson,
  getOpenRouterModelCandidates,
  hasOpenRouterKey,
} from "@/services/ai/openrouter-client";
import { applyRecruiterScoreGuardrails } from "@/services/ai/analysis-guardrails";

const COLLECTION = "recruiter_score_jobs";
const MAX_RETRIES = Number(process.env.RECRUITER_SCORE_JOB_MAX_RETRIES ?? 3);

const SCORE_MODEL_CANDIDATES = getOpenRouterModelCandidates(
  process.env.OPENROUTER_HARSH_ANALYSIS_MODEL,
  process.env.OPENROUTER_EVALUATION_MODEL,
  "openai/gpt-4.1-mini",
  process.env.OPENROUTER_MODEL,
  process.env.GOOGLE_AI_FEEDBACK_MODEL,
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
  return `
You are a strict recruiter panel evaluating interview performance for hiring decisions.

MANDATORY RULES:
1) Evidence-only scoring: use only explicit transcript evidence.
2) Resume references are not technical proof.
3) Be harsh and realistic; do not inflate scores.
4) If technical depth is absent, technicalScore MUST be <= 35.
5) If no concrete problem-solving walkthrough exists, problemSolvingScore MUST be <= 35.
6) CommunicationScore should be penalized for vague/short/deflecting responses.

Transcript:
${transcript}

Respond in ONLY valid JSON with this exact structure:
{
  "overallScore": <number 0-100>,
  "technicalScore": <number 0-100>,
  "communicationScore": <number 0-100>,
  "problemSolvingScore": <number 0-100>,
  "recommendation": "<one of: strong_hire, hire, maybe, no_hire>",
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>"],
  "feedbackSummary": "<2-3 sentence overall assessment>"
}

Use real-world hiring standards. Return ONLY JSON.
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

  await updateApplicationStatus(applicationId, {
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
      await updateApplicationStatus(job.applicationId, {
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
    if (!transcript || transcript.trim().length < 50) {
      throw new Error("Transcript too short for recruiter scoring");
    }

    const rawScore = await generateOpenRouterJson<any>({
      prompt: buildRecruiterPrompt(transcript),
      modelCandidates: SCORE_MODEL_CANDIDATES,
      temperature: 0.2,
      maxTokens: 1_800,
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
    });

    await updateApplicationStatus(job.applicationId, {
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
      await updateApplicationStatus(job.applicationId, {
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
  const candidates = apps
    .filter(
      (app) =>
        app.interviewStatus === "completed" &&
        Boolean(app.interviewId) &&
        app.scoreStatus !== "available"
    )
    .slice(0, 20);

  for (const app of candidates) {
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
