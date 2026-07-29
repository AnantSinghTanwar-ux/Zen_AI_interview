import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_BATCH_DELAY_MS,
  MAX_RESUME_LENGTH,
  REDIS_JOB_EMBEDDING_KEY_PREFIX,
} from "@/constants/screening.config";

// ─── Embedding Service ──────────────────────────────────────────────────────
//
// Generates vector embeddings using Gemini text-embedding-004 and performs
// cosine similarity ranking. This is the "rough filter" stage that reduces
// 10K candidates to a manageable subset for expensive LLM scoring.
//
// Cost: ~$0.25 for 10K resumes (well within Gemini free tier).

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

/**
 * Generate an embedding for a single text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const truncated = text.slice(0, MAX_RESUME_LENGTH);

  const result = await model.embedContent(truncated);
  return result.embedding.values;
}

/**
 * Generate embeddings for a batch of texts.
 *
 * Processes in chunks of EMBEDDING_BATCH_SIZE with delays between
 * batches to respect API rate limits (1,500 RPM for free tier).
 *
 * @returns Array of embedding vectors, parallel to input texts.
 *          Failed embeddings are returned as empty arrays.
 */
export async function batchGenerateEmbeddings(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const results: number[][] = new Array(texts.length).fill([]);

  const totalBatches = Math.ceil(texts.length / EMBEDDING_BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start = batchIdx * EMBEDDING_BATCH_SIZE;
    const end = Math.min(start + EMBEDDING_BATCH_SIZE, texts.length);
    const batchTexts = texts.slice(start, end);

    try {
      // Process each text in the batch individually to handle per-item failures
      const batchPromises = batchTexts.map(async (text, i) => {
        try {
          const truncated = text.slice(0, MAX_RESUME_LENGTH);
          if (!truncated.trim()) {
            return { index: start + i, embedding: [] as number[] };
          }

          const result = await model.embedContent(truncated);
          return { index: start + i, embedding: result.embedding.values };
        } catch (err) {
          console.error(
            `[Embedding] Failed for text at index ${start + i}:`,
            err instanceof Error ? err.message : err
          );
          return { index: start + i, embedding: [] as number[] };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results[result.value.index] = result.value.embedding;
        }
      }
    } catch (err) {
      console.error(
        `[Embedding] Batch ${batchIdx + 1}/${totalBatches} failed:`,
        err instanceof Error ? err.message : err
      );
    }

    // Report progress
    onProgress?.(Math.min(end, texts.length), texts.length);

    // Rate limiting delay between batches (skip after last batch)
    if (batchIdx < totalBatches - 1) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, EMBEDDING_BATCH_DELAY_MS)
      );
    }
  }

  return results;
}

// ─── Cosine Similarity ──────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two vectors.
 *
 * For 768-dim vectors, this runs in <0.01ms per pair.
 * Ranking 10K vectors takes ~30ms total — no vector DB needed.
 *
 * @returns Similarity score in range [-1, 1]. Higher = more similar.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Rank candidates by cosine similarity against a reference embedding (job description).
 *
 * @param candidateEmbeddings Array of { id, embedding } pairs.
 * @param jobEmbedding The job description embedding vector.
 * @returns Sorted array (highest similarity first) with similarity scores.
 */
export function rankBySimilarity(
  candidateEmbeddings: Array<{ id: string; embedding: number[] }>,
  jobEmbedding: number[]
): Array<{ id: string; similarity: number }> {
  const scored = candidateEmbeddings
    .filter((c) => c.embedding.length === EMBEDDING_DIMENSIONS)
    .map((c) => ({
      id: c.id,
      similarity: cosineSimilarity(c.embedding, jobEmbedding),
    }));

  // Sort descending by similarity
  scored.sort((a, b) => b.similarity - a.similarity);

  return scored;
}

/**
 * Select the top K candidates from ranked results.
 *
 * @param ranked Sorted candidate scores from rankBySimilarity.
 * @param topK Number of candidates to select.
 * @returns Top K candidate IDs with their similarity scores.
 */
export function selectTopK(
  ranked: Array<{ id: string; similarity: number }>,
  topK: number
): Array<{ id: string; similarity: number }> {
  return ranked.slice(0, Math.max(1, Math.min(topK, ranked.length)));
}

// ─── Redis Cache Helpers ────────────────────────────────────────────────────
//
// Cache job description embeddings in Redis so we don't recompute them
// across multiple screening runs for the same job.

/**
 * Build the Redis key for a job's cached embedding.
 */
export function getJobEmbeddingCacheKey(jobId: string): string {
  return `${REDIS_JOB_EMBEDDING_KEY_PREFIX}${jobId}`;
}

/**
 * Serialize an embedding vector for Redis storage.
 */
export function serializeEmbedding(embedding: number[]): string {
  return JSON.stringify(embedding);
}

/**
 * Deserialize an embedding vector from Redis.
 */
export function deserializeEmbedding(data: string): number[] {
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.every((v: any) => typeof v === "number")) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}
