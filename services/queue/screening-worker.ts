import { Worker, type Job } from "bullmq";
import { db } from "@/services/firebase/admin";
import {
  getRedisConnection,
  registerWorker,
  QUEUE_NAMES,
  WORKER_CONFIGS,
  type ExtractionJobData,
  type EmbeddingJobData,
  type ScoringJobData,
  type EmailJobData,
  type OrchestratorJobData,
  getEmbeddingQueue,
  getScoringQueue,
  getEmailQueue,
  getOrchestratorQueue,
} from "./queue.config";
import {
  extractTextFromBuffer,
  extractContacts,
  isResumeTextValid,
} from "@/services/recruiter/resume-extractor.service";
import {
  generateEmbedding,
  cosineSimilarity,
  rankBySimilarity,
  selectTopK,
  getJobEmbeddingCacheKey,
  serializeEmbedding,
  deserializeEmbedding,
} from "@/services/recruiter/embedding.service";
import {
  batchScoreCandidates,
  persistBatchScores,
  selectTopNCandidates,
} from "@/services/recruiter/batch-scoring.service";
import {
  sendInterviewInviteEmail,
} from "@/services/recruiter/email.service";
import {
  generateInterviewToken,
  buildInterviewLink,
  getInterviewDeadline,
  formatDeadline,
} from "@/services/recruiter/interview-token.service";
import {
  COLLECTION_BULK_JOBS,
  COLLECTION_BULK_CANDIDATES,
  SEMANTIC_FILTER_MULTIPLIER,
  REDIS_PROGRESS_KEY_PREFIX,
} from "@/constants/screening.config";
import { createClient } from "redis";

// ─── Screening Pipeline Workers ─────────────────────────────────────────────
//
// Each worker handles one stage of the pipeline.
// Stages are orchestrated via the OrchestratorWorker which transitions
// between stages when all jobs for a stage are complete.

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
    redisClient.on("error", (err) => {
      console.error("[ScreeningWorker] Redis error:", err?.message || err);
    });
    await redisClient.connect();
  }
  return redisClient;
}

async function updateProgress(
  bulkJobId: string,
  updates: Record<string, number | string>
): Promise<void> {
  const redis = await getRedis();
  const key = `${REDIS_PROGRESS_KEY_PREFIX}${bulkJobId}`;

  // Merge updates with existing progress
  const existing = await redis.get(key);
  const current = existing ? JSON.parse(existing) : {};
  const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };

  await redis.set(key, JSON.stringify(merged), { EX: 86400 }); // 24hr TTL
}

async function updateFirestoreJob(
  bulkJobId: string,
  updates: Record<string, unknown>
): Promise<void> {
  await db.collection(COLLECTION_BULK_JOBS).doc(bulkJobId).update(updates);
}

// ── 1. Extraction Worker ────────────────────────────────────────────────────

function createExtractionWorker(): Worker {
  const worker = new Worker<ExtractionJobData>(
    QUEUE_NAMES.EXTRACTION,
    async (job: Job<ExtractionJobData>) => {
      const { bulkJobId, jobId, fileName, fileContent, candidateIndex } =
        job.data;

      // Decode base64 file content back to buffer
      const buffer = Buffer.from(fileContent, "base64");

      // Extract text
      const text = await extractTextFromBuffer(buffer, fileName);

      if (!isResumeTextValid(text)) {
        // Update progress: extraction failed
        await updateProgress(bulkJobId, {
          extractionFailed:
            ((await getExtractionFailedCount(bulkJobId)) || 0) + 1,
        });
        throw new Error(`Resume too short or empty: ${fileName}`);
      }

      // Extract contacts
      const contacts = extractContacts(text);

      // Store extracted candidate in Firestore
      const candidateRef = db.collection(COLLECTION_BULK_CANDIDATES).doc();
      await candidateRef.set({
        bulkJobId,
        jobId,
        fileName,
        email: contacts.email,
        phone: contacts.phone,
        name: contacts.name,
        linkedIn: contacts.linkedIn,
        resumeText: text,
        resumeStorageUrl: "", // TODO: upload to storage if persistence needed
        embeddingVector: null,
        semanticScore: null,
        llmScore: null,
        skillMatchPercent: null,
        recommendation: null,
        assessmentSummary: null,
        matchedSkills: [],
        missingSkills: [],
        interviewToken: null,
        interviewLink: null,
        emailSentAt: null,
        emailId: null,
        isShortlisted: false,
        createdAt: new Date().toISOString(),
      });

      // Update progress
      const redis = await getRedis();
      const extracted = await redis.incr(
        `screening:counter:${bulkJobId}:extracted`
      );
      await updateProgress(bulkJobId, {
        stage: "extracting",
        extracted,
        message: `Extracted ${extracted} resumes...`,
      });

      return { candidateId: candidateRef.id, contacts };
    },
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONFIGS.extraction.concurrency,
    }
  );

  registerWorker(worker);
  return worker;
}

async function getExtractionFailedCount(
  bulkJobId: string
): Promise<number> {
  const redis = await getRedis();
  const count = await redis.get(
    `screening:counter:${bulkJobId}:extraction_failed`
  );
  return count ? parseInt(count, 10) : 0;
}

// ── 2. Embedding Worker ─────────────────────────────────────────────────────

function createEmbeddingWorker(): Worker {
  const worker = new Worker<EmbeddingJobData>(
    QUEUE_NAMES.EMBEDDING,
    async (job: Job<EmbeddingJobData>) => {
      const { bulkJobId, candidateId, resumeText } = job.data;

      const embedding = await generateEmbedding(resumeText);

      // Store embedding on candidate doc
      await db.collection(COLLECTION_BULK_CANDIDATES).doc(candidateId).update({
        embeddingVector: embedding,
      });

      // Update progress counter
      const redis = await getRedis();
      const embedded = await redis.incr(
        `screening:counter:${bulkJobId}:embedded`
      );
      await updateProgress(bulkJobId, {
        stage: "embedding",
        embedded,
        message: `Generated ${embedded} embeddings...`,
      });

      return { candidateId, embeddingLength: embedding.length };
    },
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONFIGS.embedding.concurrency,
      limiter: WORKER_CONFIGS.embedding.limiter,
    }
  );

  registerWorker(worker);
  return worker;
}

// ── 3. Email Worker ─────────────────────────────────────────────────────────

function createEmailWorker(): Worker {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
      const {
        bulkJobId,
        candidateId,
        candidateEmail,
        candidateName,
        jobTitle,
        companyName,
        interviewLink,
        deadline,
      } = job.data;

      const result = await sendInterviewInviteEmail({
        to: candidateEmail,
        candidateName: candidateName || "Candidate",
        jobTitle,
        companyName,
        interviewLink,
        deadline,
      });

      if (!result.success) {
        // Update failed counter
        const redis = await getRedis();
        await redis.incr(`screening:counter:${bulkJobId}:email_failed`);
        await updateProgress(bulkJobId, {
          emailFailed: parseInt(
            (await redis.get(
              `screening:counter:${bulkJobId}:email_failed`
            )) || "0",
            10
          ),
        });
        throw new Error(result.error || "Email send failed");
      }

      // Update candidate with email info
      await db.collection(COLLECTION_BULK_CANDIDATES).doc(candidateId).update({
        emailSentAt: new Date().toISOString(),
        emailId: result.emailId,
      });

      // Update progress counter
      const redis = await getRedis();
      const emailed = await redis.incr(
        `screening:counter:${bulkJobId}:emailed`
      );
      await updateProgress(bulkJobId, {
        stage: "emailing",
        emailed,
        message: `Sent ${emailed} interview invitations...`,
      });

      return { candidateId, emailId: result.emailId };
    },
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONFIGS.email.concurrency,
      limiter: WORKER_CONFIGS.email.limiter,
    }
  );

  registerWorker(worker);
  return worker;
}

// ── 4. Orchestrator Worker ──────────────────────────────────────────────────
//
// Coordinates stage transitions. When all extraction jobs complete,
// it enqueues embedding jobs. When all embeddings complete, it triggers
// semantic ranking + scoring, etc.

function createOrchestratorWorker(): Worker {
  const worker = new Worker<OrchestratorJobData>(
    QUEUE_NAMES.ORCHESTRATOR,
    async (job: Job<OrchestratorJobData>) => {
      const { bulkJobId, jobId, topN, stage } = job.data;

      switch (stage) {
        case "start_embedding": {
          // Fetch all extracted candidates
          const candidates = await db
            .collection(COLLECTION_BULK_CANDIDATES)
            .where("bulkJobId", "==", bulkJobId)
            .get();

          if (candidates.empty) {
            await updateFirestoreJob(bulkJobId, {
              stage: "failed",
              error: "No candidates were successfully extracted",
            });
            return;
          }

          await updateFirestoreJob(bulkJobId, { stage: "embedding" });
          await updateProgress(bulkJobId, {
            stage: "embedding",
            message: "Starting embedding generation...",
          });

          // Generate job description embedding first
          const jobDoc = await db.collection("jobs").doc(jobId).get();
          const jobDescription = jobDoc.data()?.description || "";
          const jobSkills = (jobDoc.data()?.requiredSkills || []).join(", ");
          const jobText = `${jobDoc.data()?.title || ""} ${jobDescription} ${jobSkills}`;

          const jobEmbedding = await generateEmbedding(jobText);

          // Cache job embedding in Redis
          const redis = await getRedis();
          await redis.set(
            getJobEmbeddingCacheKey(jobId),
            serializeEmbedding(jobEmbedding),
            { EX: 86400 }
          );

          // Enqueue embedding jobs for each candidate
          const embeddingQueue = getEmbeddingQueue();
          for (const doc of candidates.docs) {
            const data = doc.data();
            await embeddingQueue.add(`embed-${doc.id}`, {
              bulkJobId,
              candidateId: doc.id,
              resumeText: data.resumeText || "",
            } as EmbeddingJobData);
          }

          break;
        }

        case "start_scoring": {
          await updateFirestoreJob(bulkJobId, { stage: "ranking" });
          await updateProgress(bulkJobId, {
            stage: "ranking",
            message: "Performing semantic ranking...",
          });

          // Fetch job embedding from Redis
          const redis = await getRedis();
          const cachedEmbedding = await redis.get(
            getJobEmbeddingCacheKey(jobId)
          );
          const jobEmbedding = cachedEmbedding
            ? deserializeEmbedding(cachedEmbedding)
            : [];

          if (jobEmbedding.length === 0) {
            await updateFirestoreJob(bulkJobId, {
              stage: "failed",
              error: "Job embedding not found in cache",
            });
            return;
          }

          // Fetch all candidates with embeddings
          const allCandidates = await db
            .collection(COLLECTION_BULK_CANDIDATES)
            .where("bulkJobId", "==", bulkJobId)
            .get();

          const candidatesWithEmbeddings = allCandidates.docs
            .filter((doc) => {
              const data = doc.data();
              return (
                Array.isArray(data.embeddingVector) &&
                data.embeddingVector.length > 0
              );
            })
            .map((doc) => ({
              id: doc.id,
              embedding: doc.data().embeddingVector as number[],
              resumeText: doc.data().resumeText as string,
            }));

          // Rank by cosine similarity
          const ranked = rankBySimilarity(
            candidatesWithEmbeddings.map((c) => ({
              id: c.id,
              embedding: c.embedding,
            })),
            jobEmbedding
          );

          // Select top (topN × multiplier) for LLM scoring
          const llmCandidateCount = topN * SEMANTIC_FILTER_MULTIPLIER;
          const topCandidates = selectTopK(ranked, llmCandidateCount);

          // Update semantic scores in Firestore
          const batch = db.batch();
          for (const candidate of topCandidates) {
            batch.update(
              db.collection(COLLECTION_BULK_CANDIDATES).doc(candidate.id),
              { semanticScore: candidate.similarity }
            );
          }
          await batch.commit();

          await updateProgress(bulkJobId, {
            stage: "llm_scoring",
            semanticFiltered: topCandidates.length,
            message: `Ranked candidates. Scoring top ${topCandidates.length}...`,
          });

          await updateFirestoreJob(bulkJobId, { stage: "llm_scoring" });

          // Fetch job details for LLM scoring
          const jobDoc = await db
            .collection("jobs")
            .doc(jobId)
            .get();
          const job = { id: jobDoc.id, ...jobDoc.data() } as any;

          // Build candidate data for batch scoring
          const candidateMap = new Map(
            candidatesWithEmbeddings.map((c) => [c.id, c.resumeText])
          );
          const candidatesToScore = topCandidates
            .map((c) => ({
              id: c.id,
              resumeText: candidateMap.get(c.id) || "",
            }))
            .filter((c) => c.resumeText.length > 0);

          // Batch score via LLM
          const scores = await batchScoreCandidates(
            candidatesToScore,
            job,
            undefined,
            async (completed, total) => {
              await updateProgress(bulkJobId, {
                llmScored: completed,
                message: `Scored ${completed}/${total} candidates...`,
              });
            }
          );

          // Persist scores
          await persistBatchScores(scores);

          // Select final top N
          const shortlistedIds = selectTopNCandidates(scores, topN);

          // Mark shortlisted candidates
          const shortlistBatch = db.batch();
          for (const id of shortlistedIds) {
            shortlistBatch.update(
              db.collection(COLLECTION_BULK_CANDIDATES).doc(id),
              { isShortlisted: true }
            );
          }
          await shortlistBatch.commit();

          await updateProgress(bulkJobId, {
            shortlisted: shortlistedIds.length,
            message: `Shortlisted ${shortlistedIds.length} candidates. Starting email...`,
          });

          // Trigger email stage
          const orchestratorQueue = getOrchestratorQueue();
          await orchestratorQueue.add(`email-${bulkJobId}`, {
            bulkJobId,
            jobId,
            topN,
            stage: "start_emailing",
          } as OrchestratorJobData);

          break;
        }

        case "start_emailing": {
          await updateFirestoreJob(bulkJobId, { stage: "emailing" });
          await updateProgress(bulkJobId, {
            stage: "emailing",
            message: "Sending interview invitations...",
          });

          // Fetch shortlisted candidates
          const shortlisted = await db
            .collection(COLLECTION_BULK_CANDIDATES)
            .where("bulkJobId", "==", bulkJobId)
            .where("isShortlisted", "==", true)
            .get();

          // Fetch job details for email content
          const jobDoc = await db
            .collection("jobs")
            .doc(jobId)
            .get();
          const jobData = jobDoc.data();
          const jobTitle = jobData?.title || "Position";
          const companyName = jobData?.companyName || "Company";

          const deadline = getInterviewDeadline();
          const deadlineStr = formatDeadline(deadline);

          // Enqueue email jobs
          const emailQueue = getEmailQueue();
          for (const doc of shortlisted.docs) {
            const data = doc.data();
            const email = data.email;
            if (!email) continue;

            // Generate interview token and link
            const token = generateInterviewToken(doc.id, jobId, bulkJobId);
            const link = buildInterviewLink(token);

            // Update candidate with token/link
            await doc.ref.update({
              interviewToken: token,
              interviewLink: link,
            });

            await emailQueue.add(`email-${doc.id}`, {
              bulkJobId,
              candidateId: doc.id,
              candidateEmail: email,
              candidateName: data.name || "Candidate",
              jobTitle,
              companyName,
              interviewToken: token,
              interviewLink: link,
              deadline: deadlineStr,
            } as EmailJobData);
          }

          break;
        }

        case "finalize": {
          await updateFirestoreJob(bulkJobId, {
            stage: "completed",
            completedAt: new Date().toISOString(),
          });

          await updateProgress(bulkJobId, {
            stage: "completed",
            message: "Screening pipeline completed!",
          });

          // Clean up Redis counters (keep progress for 24hr)
          const redis = await getRedis();
          const counterKeys = await redis.keys(
            `screening:counter:${bulkJobId}:*`
          );
          if (counterKeys.length > 0) {
            await redis.del(counterKeys);
          }

          break;
        }
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 1, // Orchestrator is sequential
    }
  );

  registerWorker(worker);
  return worker;
}

// ─── Worker Startup ─────────────────────────────────────────────────────────

let workersStarted = false;

/**
 * Start all screening pipeline workers.
 * Idempotent — safe to call multiple times.
 */
export function startScreeningWorkers(): void {
  if (workersStarted) {
    console.log("[ScreeningWorker] Workers already started.");
    return;
  }

  console.log("[ScreeningWorker] Starting pipeline workers...");

  const extractionWorker = createExtractionWorker();
  const embeddingWorker = createEmbeddingWorker();
  const emailWorker = createEmailWorker();
  const orchestratorWorker = createOrchestratorWorker();

  // Listen for completion events to trigger stage transitions
  extractionWorker.on("completed", async (job) => {
    // Check if all extraction jobs are done
    if (!job) return;
    const { bulkJobId, jobId } = job.data;

    try {
      const redis = await getRedis();
      const extracted = parseInt(
        (await redis.get(`screening:counter:${bulkJobId}:extracted`)) || "0",
        10
      );

      const jobDoc = await db
        .collection(COLLECTION_BULK_JOBS)
        .doc(bulkJobId)
        .get();
      const totalResumes = jobDoc.data()?.totalResumes || 0;
      const topN = jobDoc.data()?.topN || 200;

      const failedCount = await getExtractionFailedCount(bulkJobId);
      const totalProcessed = extracted + failedCount;

      if (totalProcessed >= totalResumes) {
        // All extractions done — trigger embedding stage
        const orchestratorQueue = getOrchestratorQueue();
        await orchestratorQueue.add(`embed-${bulkJobId}`, {
          bulkJobId,
          jobId,
          topN,
          stage: "start_embedding",
        } as OrchestratorJobData);
      }
    } catch (err) {
      console.error(
        "[ScreeningWorker] Error in extraction completion handler:",
        err
      );
    }
  });

  embeddingWorker.on("completed", async (job) => {
    if (!job) return;
    const { bulkJobId } = job.data;

    try {
      const redis = await getRedis();
      const embedded = parseInt(
        (await redis.get(`screening:counter:${bulkJobId}:embedded`)) || "0",
        10
      );

      // Count total candidates for this bulk job
      const candidates = await db
        .collection(COLLECTION_BULK_CANDIDATES)
        .where("bulkJobId", "==", bulkJobId)
        .get();

      if (embedded >= candidates.size) {
        // All embeddings done — trigger scoring stage
        const jobDoc = await db
          .collection(COLLECTION_BULK_JOBS)
          .doc(bulkJobId)
          .get();
        const jobId = jobDoc.data()?.jobId || "";
        const topN = jobDoc.data()?.topN || 200;

        const orchestratorQueue = getOrchestratorQueue();
        await orchestratorQueue.add(`score-${bulkJobId}`, {
          bulkJobId,
          jobId,
          topN,
          stage: "start_scoring",
        } as OrchestratorJobData);
      }
    } catch (err) {
      console.error(
        "[ScreeningWorker] Error in embedding completion handler:",
        err
      );
    }
  });

  emailWorker.on("completed", async (job) => {
    if (!job) return;
    const { bulkJobId } = job.data;

    try {
      const redis = await getRedis();
      const emailed = parseInt(
        (await redis.get(`screening:counter:${bulkJobId}:emailed`)) || "0",
        10
      );
      const emailFailed = parseInt(
        (await redis.get(`screening:counter:${bulkJobId}:email_failed`)) ||
          "0",
        10
      );

      // Count shortlisted candidates
      const shortlisted = await db
        .collection(COLLECTION_BULK_CANDIDATES)
        .where("bulkJobId", "==", bulkJobId)
        .where("isShortlisted", "==", true)
        .get();

      // Count only those with an email (sendable)
      const sendable = shortlisted.docs.filter(
        (d) => d.data().email
      ).length;

      if (emailed + emailFailed >= sendable) {
        // All emails sent — finalize
        const jobDoc = await db
          .collection(COLLECTION_BULK_JOBS)
          .doc(bulkJobId)
          .get();
        const jobId = jobDoc.data()?.jobId || "";
        const topN = jobDoc.data()?.topN || 200;

        const orchestratorQueue = getOrchestratorQueue();
        await orchestratorQueue.add(`finalize-${bulkJobId}`, {
          bulkJobId,
          jobId,
          topN,
          stage: "finalize",
        } as OrchestratorJobData);
      }
    } catch (err) {
      console.error(
        "[ScreeningWorker] Error in email completion handler:",
        err
      );
    }
  });

  // Error logging for all workers
  [extractionWorker, embeddingWorker, emailWorker, orchestratorWorker].forEach(
    (w) => {
      w.on("failed", (job, err) => {
        console.error(
          `[ScreeningWorker:${w.name}] Job ${job?.id} failed:`,
          err?.message || err
        );
      });
      w.on("error", (err) => {
        console.error(`[ScreeningWorker:${w.name}] Worker error:`, err);
      });
    }
  );

  workersStarted = true;
  console.log("[ScreeningWorker] All pipeline workers started.");
}

/**
 * Stop all screening pipeline workers.
 */
export async function stopScreeningWorkers(): Promise<void> {
  const { shutdownAllWorkers, closeAllQueues } = await import("./queue.config");
  await shutdownAllWorkers();
  await closeAllQueues();

  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }

  workersStarted = false;
  console.log("[ScreeningWorker] All pipeline workers stopped.");
}
