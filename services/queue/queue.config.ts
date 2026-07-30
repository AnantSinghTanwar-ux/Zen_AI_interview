import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";
import {
  EXTRACTION_CONCURRENCY,
  EMBEDDING_CONCURRENCY,
  LLM_SCORING_CONCURRENCY,
  EMAIL_CONCURRENCY,
  EMAIL_RATE_PER_SECOND,
} from "@/constants/screening.config";

// ─── BullMQ Queue Configuration ─────────────────────────────────────────────
//
// Centralized queue definitions for the bulk screening pipeline.
// Uses the existing Redis instance (REDIS_URL from .env).
//
// Queue architecture:
//   extraction → embedding → scoring → email
//   Each stage has its own queue for independent scaling and monitoring.

export const QUEUE_NAMES = {
  EXTRACTION: "screening:extraction",
  EMBEDDING: "screening:embedding",
  SCORING: "screening:scoring",
  EMAIL: "screening:email",
  ORCHESTRATOR: "screening:orchestrator",
} as const;

/**
 * Build BullMQ connection options from REDIS_URL.
 * Falls back to localhost for development.
 */
export function getRedisConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL || "redis://localhost:6379";

  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
  } catch {
    // Fallback for simple host:port format
    return { host: "localhost", port: 6379 };
  }
}

// ─── Queue Instances ────────────────────────────────────────────────────────
//
// Lazy-initialized to avoid connecting to Redis at import time.

let _extractionQueue: Queue | null = null;
let _embeddingQueue: Queue | null = null;
let _scoringQueue: Queue | null = null;
let _emailQueue: Queue | null = null;
let _orchestratorQueue: Queue | null = null;

function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });
}

export function getExtractionQueue(): Queue {
  if (!_extractionQueue) _extractionQueue = createQueue(QUEUE_NAMES.EXTRACTION);
  return _extractionQueue;
}

export function getEmbeddingQueue(): Queue {
  if (!_embeddingQueue) _embeddingQueue = createQueue(QUEUE_NAMES.EMBEDDING);
  return _embeddingQueue;
}

export function getScoringQueue(): Queue {
  if (!_scoringQueue) _scoringQueue = createQueue(QUEUE_NAMES.SCORING);
  return _scoringQueue;
}

export function getEmailQueue(): Queue {
  if (!_emailQueue) _emailQueue = createQueue(QUEUE_NAMES.EMAIL);
  return _emailQueue;
}

export function getOrchestratorQueue(): Queue {
  if (!_orchestratorQueue)
    _orchestratorQueue = createQueue(QUEUE_NAMES.ORCHESTRATOR);
  return _orchestratorQueue;
}

// ─── Job Data Types ─────────────────────────────────────────────────────────

export interface ExtractionJobData {
  bulkJobId: string;
  jobId: string;
  fileName: string;
  /** Base64-encoded file content. */
  fileContent: string;
  candidateIndex: number;
}

export interface EmbeddingJobData {
  bulkJobId: string;
  candidateId: string;
  resumeText: string;
}

export interface ScoringJobData {
  bulkJobId: string;
  candidateId: string;
  resumeText: string;
  jobId: string;
}

export interface EmailJobData {
  bulkJobId: string;
  candidateId: string;
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  interviewToken: string;
  interviewLink: string;
  deadline: string;
}

export interface OrchestratorJobData {
  bulkJobId: string;
  jobId: string;
  topN: number;
  stage: "start_embedding" | "start_scoring" | "start_emailing" | "finalize";
}

// ─── Worker Configuration ───────────────────────────────────────────────────

export const WORKER_CONFIGS = {
  extraction: {
    concurrency: EXTRACTION_CONCURRENCY,
  },
  embedding: {
    concurrency: EMBEDDING_CONCURRENCY,
    limiter: { max: 100, duration: 60_000 }, // 100 per minute (Gemini free tier)
  },
  scoring: {
    concurrency: LLM_SCORING_CONCURRENCY,
    limiter: { max: 30, duration: 60_000 }, // 30 per minute
  },
  email: {
    concurrency: EMAIL_CONCURRENCY,
    limiter: { max: EMAIL_RATE_PER_SECOND, duration: 1000 },
  },
} as const;

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

const registeredWorkers: Worker[] = [];

export function registerWorker(worker: Worker): void {
  registeredWorkers.push(worker);
}

export async function shutdownAllWorkers(): Promise<void> {
  console.log(
    `[Queue] Shutting down ${registeredWorkers.length} worker(s)...`
  );
  await Promise.allSettled(
    registeredWorkers.map((w) => w.close())
  );
  console.log("[Queue] All workers shut down.");
}

export async function closeAllQueues(): Promise<void> {
  const queues = [
    _extractionQueue,
    _embeddingQueue,
    _scoringQueue,
    _emailQueue,
    _orchestratorQueue,
  ].filter(Boolean) as Queue[];

  await Promise.allSettled(queues.map((q) => q.close()));
}
