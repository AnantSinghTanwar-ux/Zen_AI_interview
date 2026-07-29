// ─── Bulk Screening Pipeline Configuration ──────────────────────────────────
//
// Tuning knobs for the resume screening pipeline.
// All values can be overridden via environment variables.

/** Maximum resume text length (chars) sent to AI. Controls cost. */
export const MAX_RESUME_LENGTH = Number(process.env.SCREENING_MAX_RESUME_LENGTH ?? 12_000);

/** Maximum file size for a single resume upload (bytes). Default: 10MB. */
export const MAX_RESUME_FILE_SIZE = Number(process.env.SCREENING_MAX_FILE_SIZE ?? 10 * 1024 * 1024);

/** Maximum number of resumes in a single bulk upload. */
export const MAX_BULK_UPLOAD_COUNT = Number(process.env.SCREENING_MAX_UPLOAD_COUNT ?? 10_000);

/** Accepted file extensions for resume upload. */
export const ACCEPTED_RESUME_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt"];

/** MIME types corresponding to accepted extensions. */
export const ACCEPTED_RESUME_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

// ── Extraction Stage ──

/** Worker concurrency for text extraction (CPU-bound, fast). */
export const EXTRACTION_CONCURRENCY = Number(process.env.SCREENING_EXTRACTION_CONCURRENCY ?? 20);

/** Minimum extracted text length to consider a resume valid. */
export const MIN_RESUME_TEXT_LENGTH = 50;

// ── Embedding Stage ──

/** Batch size for embedding API calls. Gemini supports up to 100 texts per batch. */
export const EMBEDDING_BATCH_SIZE = Number(process.env.SCREENING_EMBEDDING_BATCH_SIZE ?? 100);

/** Worker concurrency for embedding generation (API rate-limited). */
export const EMBEDDING_CONCURRENCY = Number(process.env.SCREENING_EMBEDDING_CONCURRENCY ?? 5);

/** Delay between embedding batches (ms) to stay within rate limits. */
export const EMBEDDING_BATCH_DELAY_MS = Number(process.env.SCREENING_EMBEDDING_BATCH_DELAY_MS ?? 200);

/** Embedding model to use. */
export const EMBEDDING_MODEL = process.env.SCREENING_EMBEDDING_MODEL || "text-embedding-004";

/** Embedding vector dimensions. text-embedding-004 outputs 768 dims. */
export const EMBEDDING_DIMENSIONS = 768;

// ── Semantic Ranking Stage ──

/**
 * Multiplier applied to topN to determine how many candidates pass to the LLM stage.
 * E.g., if topN = 200, multiplier = 2 → top 400 candidates are LLM-scored.
 * Higher = more accurate but more expensive.
 */
export const SEMANTIC_FILTER_MULTIPLIER = Number(
  process.env.SCREENING_SEMANTIC_FILTER_MULTIPLIER ?? 2
);

// ── LLM Scoring Stage ──

/** Concurrency for LLM scoring calls. */
export const LLM_SCORING_CONCURRENCY = Number(process.env.SCREENING_LLM_CONCURRENCY ?? 10);

/** Max tokens for LLM scoring response. */
export const LLM_SCORING_MAX_TOKENS = 1_500;

/** Temperature for LLM scoring (low for consistency). */
export const LLM_SCORING_TEMPERATURE = 0.15;

// ── Email Stage ──

/** Max emails per second (Resend Pro: 14/s, Free: 2/s). */
export const EMAIL_RATE_PER_SECOND = Number(process.env.SCREENING_EMAIL_RATE_PER_SECOND ?? 14);

/** Worker concurrency for email sending. */
export const EMAIL_CONCURRENCY = Number(process.env.SCREENING_EMAIL_CONCURRENCY ?? 10);

/** Number of days before interview link expires. */
export const INTERVIEW_LINK_EXPIRY_DAYS = Number(process.env.SCREENING_LINK_EXPIRY_DAYS ?? 7);

// ── SSE Progress ──

/** Interval (ms) between SSE progress updates pushed to the frontend. */
export const SSE_PROGRESS_INTERVAL_MS = Number(process.env.SCREENING_SSE_INTERVAL_MS ?? 500);

/** Redis key prefix for storing pipeline progress. */
export const REDIS_PROGRESS_KEY_PREFIX = "screening:progress:";

/** Redis key prefix for storing job embedding cache. */
export const REDIS_JOB_EMBEDDING_KEY_PREFIX = "screening:job_embedding:";

// ── Firestore Collections ──

export const COLLECTION_BULK_JOBS = "bulk_screening_jobs";
export const COLLECTION_BULK_CANDIDATES = "bulk_candidates";

// ── Upload Chunking ──

/** Number of files per upload chunk (client-side). */
export const UPLOAD_CHUNK_SIZE = 50;

/** Maximum concurrent upload chunks. */
export const MAX_CONCURRENT_UPLOAD_CHUNKS = 3;
