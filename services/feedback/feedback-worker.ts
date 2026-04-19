/**
 * Background Feedback Worker
 *
 * Polls the `feedback_jobs` collection for pending jobs and processes them
 * using the AI provider abstraction. Designed to run as a standalone
 * process on Render (or any long-lived Node server).
 *
 * Can also be imported and started in-process for development.
 */

import { db } from "@/services/firebase/admin";
import { aiProvider } from "@/services/ai/ai-provider";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { callLogService } from "@/services/firebase/call-log.service";
import { retryWithBackoff } from "@/lib/services/retry.service";
import {
  getRecruiterScoreQueueMetrics,
  processPendingRecruiterScoreJobs,
} from "@/services/recruiter/recruiter-score-queue.service";

const BATCH_SIZE = 10;
const RECRUITER_SCORE_BATCH_SIZE = 5;
const POLL_INTERVAL_MS = 5_000;
const MAX_RETRIES = 3;

// ── Transcript extraction helpers ──────────────────────────────────────────

function extractTranscriptFromCallData(callData: Record<string, unknown>): string {
  const messages = (callData.messages ?? (callData as Record<string, unknown>).artifact?.messages ?? []) as Array<Record<string, unknown>>;
  if (!Array.isArray(messages)) return "";

  return messages
    .filter((msg) => {
      if (msg.type === "transcript" && msg.transcriptType === "final") return true;
      if (
        (msg.role === "user" || msg.role === "assistant" || msg.role === "bot") &&
        (msg.content || msg.message || msg.transcript)
      )
        return true;
      return false;
    })
    .map((msg) => {
      const role = msg.role === "user" ? "Candidate" : "Interviewer";
      const content = (msg.transcript || msg.content || msg.message || "") as string;
      return `${role}: ${content}`;
    })
    .join("\n");
}

// ── Job processor ──────────────────────────────────────────────────────────

async function processJob(jobId: string, job: Record<string, unknown>): Promise<void> {
  const start = Date.now();

  try {
    // Mark processing
    await db.collection("feedback_jobs").doc(jobId).update({
      status: "processing",
      startedAt: new Date().toISOString(),
    });

    // Fetch transcript — try Vapi first, then Firestore
    let transcript = "";
    const callId = job.callId as string;

    try {
      const callData = await vapiCallDataService.getCall(callId);
      transcript = extractTranscriptFromCallData(callData as unknown as Record<string, unknown>);
    } catch {
      // Fallback: look in Firestore call logs
      try {
        const log = await callLogService.getCallLogByVapiId(callId);
        if (log?.transcript) transcript = log.transcript as string;
      } catch {
        // also try by doc id
        try {
          const log = await callLogService.getCallLogById(callId);
          if (log?.transcript) transcript = log.transcript as string;
        } catch {
          // exhausted options
        }
      }
    }

    if (!transcript || transcript.trim().length < 20) {
      throw new Error("Transcript too short or unavailable");
    }

    // Generate feedback with retry + circuit-breaker-like logic
    const feedback = await retryWithBackoff(
      () => aiProvider.generateFeedback(transcript),
      { maxRetries: 2, initialDelayMs: 500 }
    );

    const processingTimeMs = Date.now() - start;

    // Mark completed
    await db.collection("feedback_jobs").doc(jobId).update({
      status: "completed",
      feedback,
      completedAt: new Date().toISOString(),
      processingTimeMs,
      modelUsed: aiProvider.getName(),
    });

    console.log(`[Worker] Job ${jobId} completed in ${processingTimeMs}ms`);
  } catch (err) {
    console.error(`[Worker] Job ${jobId} failed:`, (err as Error)?.message);

    const retryCount = ((job.retryCount as number) || 0) + 1;
    const newStatus = retryCount >= MAX_RETRIES ? "failed" : "pending";

    await db
      .collection("feedback_jobs")
      .doc(jobId)
      .update({
        status: newStatus,
        retryCount,
        error: (err as Error)?.message || String(err),
      });
  }
}

// ── Poll loop ──────────────────────────────────────────────────────────────

async function processPendingFeedbackJobs(): Promise<void> {
  const snapshot = await db
    .collection("feedback_jobs")
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .limit(BATCH_SIZE)
    .get();

  if (snapshot.empty) return;

  for (const doc of snapshot.docs) {
    await processJob(doc.id, doc.data());
    // Small gap between jobs to avoid CPU spikes
    await new Promise<void>((r) => setTimeout(r, 100));
  }
}

async function processPendingJobs(): Promise<void> {
  await processPendingFeedbackJobs();
  await processPendingRecruiterScoreJobs(RECRUITER_SCORE_BATCH_SIZE);
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startFeedbackWorker(): void {
  if (intervalHandle) {
    console.warn("[Worker] Already running");
    return;
  }

  console.log("[Worker] Feedback worker started");

  // Run immediately on start, then on interval
  processPendingJobs().catch(console.error);

  intervalHandle = setInterval(() => {
    processPendingJobs().catch((err) =>
      console.error("[Worker] Poll error:", err)
    );
  }, POLL_INTERVAL_MS);
}

export function stopFeedbackWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[Worker] Feedback worker stopped");
  }
}

// ── Metrics ────────────────────────────────────────────────────────────────

export async function getWorkerMetrics() {
  const [completed, failed, pending] = await Promise.all([
    db.collection("feedback_jobs").where("status", "==", "completed").get(),
    db.collection("feedback_jobs").where("status", "==", "failed").get(),
    db.collection("feedback_jobs").where("status", "==", "pending").get(),
  ]);

  const times = completed.docs.map((d) => (d.data().processingTimeMs as number) || 0);
  const avgMs = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const recruiterQueue = await getRecruiterScoreQueueMetrics();

  return {
    jobsPending: pending.size,
    jobsCompleted: completed.size,
    jobsFailed: failed.size,
    avgProcessingTimeMs: Math.round(avgMs),
    recruiterScoreQueue: recruiterQueue,
  };
}
