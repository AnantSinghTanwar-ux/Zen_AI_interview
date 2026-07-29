// ─── Bulk Resume Screening Pipeline Types ───────────────────────────────────

/**
 * Pipeline stages flow:
 *   uploading → extracting → embedding → ranking → llm_scoring → emailing → completed
 *                                                                          ↘ failed
 */
export type ScreeningStage =
  | "uploading"
  | "extracting"
  | "embedding"
  | "ranking"
  | "llm_scoring"
  | "emailing"
  | "completed"
  | "failed";

/**
 * Root document for a bulk screening run.
 * Stored in Firestore collection: `bulk_screening_jobs`
 */
export interface BulkScreeningJob {
  id: string;
  recruiterId: string;
  jobId: string;

  /** Total number of resumes uploaded in this batch. */
  totalResumes: number;

  /** Recruiter-specified cutoff: how many top candidates to shortlist. */
  topN: number;

  /** Current stage of the pipeline. */
  stage: ScreeningStage;

  /** Aggregate progress counters. */
  progress: ScreeningProgress;

  /** Semantic filter multiplier — how many candidates pass to LLM stage (topN × this). */
  semanticFilterMultiplier: number;

  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface ScreeningProgress {
  extracted: number;
  extractionFailed: number;
  embedded: number;
  semanticFiltered: number;
  llmScored: number;
  shortlisted: number;
  emailed: number;
  emailFailed: number;
}

/**
 * Per-candidate document produced by the extraction stage.
 * Stored in Firestore collection: `bulk_candidates`
 */
export interface ExtractedCandidate {
  id: string;
  bulkJobId: string;
  jobId: string;

  /** Original file name (e.g. "john_doe_resume.pdf"). */
  fileName: string;

  /** Contact info extracted via regex — no AI needed. */
  email: string | null;
  phone: string | null;
  name: string | null;
  linkedIn: string | null;

  /** Full extracted text (truncated to MAX_RESUME_LENGTH). */
  resumeText: string;

  /** GCS / Firebase Storage path for the original file. */
  resumeStorageUrl: string;

  // ── Scoring Fields (populated progressively) ──

  /** 768-dim embedding vector (Gemini text-embedding-004). */
  embeddingVector: number[] | null;

  /** Cosine similarity score vs job description embedding. Range: -1 to 1. */
  semanticScore: number | null;

  /** LLM-assigned overall score. Range: 0-100. */
  llmScore: number | null;

  /** LLM skill match percentage. Range: 0-100. */
  skillMatchPercent: number | null;

  /** LLM recommendation. */
  recommendation: "shortlist" | "review" | "reject" | null;

  /** LLM-generated assessment summary. */
  assessmentSummary: string | null;

  /** Matched/missing skills from LLM analysis. */
  matchedSkills: string[];
  missingSkills: string[];

  // ── Interview & Email Fields ──

  /** Unique token for this candidate's interview link. */
  interviewToken: string | null;

  /** Full interview URL sent via email. */
  interviewLink: string | null;

  /** Timestamp when invite email was sent. */
  emailSentAt: string | null;

  /** Resend email ID for tracking. */
  emailId: string | null;

  /** Whether candidate is in the final shortlist (top N). */
  isShortlisted: boolean;

  createdAt: string;
}

/**
 * SSE progress event pushed to the frontend.
 */
export interface ScreeningProgressEvent {
  jobId: string;
  stage: ScreeningStage;
  progress: ScreeningProgress;
  totalResumes: number;
  topN: number;
  message: string;
  /** Estimated time remaining in seconds (-1 if unknown). */
  estimatedSecondsRemaining: number;
}

/**
 * Candidate row as returned to the recruiter verification table.
 */
export interface ScreenedCandidateRow {
  id: string;
  rank: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedIn: string | null;
  fileName: string;
  semanticScore: number | null;
  llmScore: number | null;
  skillMatchPercent: number | null;
  recommendation: "shortlist" | "review" | "reject" | null;
  assessmentSummary: string | null;
  matchedSkills: string[];
  missingSkills: string[];
  isShortlisted: boolean;
  emailSentAt: string | null;
  interviewLink: string | null;
}
