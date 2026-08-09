import { db } from "@/services/firebase/admin";
import type { RecruitmentJob } from "@/types/recruiter";
import type { ExtractedCandidate } from "@/types/bulk-screening";
import {
  generateOpenRouterJson,
  getOpenRouterModelCandidates,
  hasOpenRouterKey,
} from "@/services/ai/openrouter-client";
import {
  LLM_SCORING_CONCURRENCY,
  LLM_SCORING_MAX_TOKENS,
  LLM_SCORING_TEMPERATURE,
  MAX_RESUME_LENGTH,
  COLLECTION_BULK_CANDIDATES,
} from "@/constants/screening.config";

// ─── Batch LLM Resume Scoring ──────────────────────────────────────────────
//
// This module scores the semantically-filtered candidate subset using
// a fast LLM (Gemini Flash / GPT-4o-mini via OpenRouter).
//
// Only processes ~400 candidates (2×N) instead of 10K — the expensive
// LLM calls are concentrated on the most promising candidates.

interface RawBatchScreeningResponse {
  scores: {
    projects: number;
    skills: number;
    experience: number;
    education: number;
  };
  overallScore: number;
  skillMatchPercent: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendation: "shortlist" | "review" | "reject";
  summary: string;
}

function clamp(value: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function sanitizeStringArray(
  arr: unknown,
  maxItems = 10,
  maxLen = 300
): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    )
    .slice(0, maxItems)
    .map((s) => s.trim().slice(0, maxLen));
}

function normalizeRecommendation(
  rec: unknown,
  score: number
): "shortlist" | "review" | "reject" {
  const value = String(rec || "")
    .toLowerCase()
    .trim();

  if (value === "shortlist" || value === "strong_hire" || value === "hire")
    return "shortlist";
  if (value === "reject" || value === "no_hire") return "reject";
  if (value === "review" || value === "maybe") return "review";

  // Derive from score if AI returned unexpected value
  if (score >= 70) return "shortlist";
  if (score >= 45) return "review";
  return "reject";
}

function buildBatchScreeningPrompt(
  resumeText: string,
  job: RecruitmentJob
): string {
  const skillsList = job.requiredSkills.join(", ");

  return `You are an expert recruitment AI screening assistant. Analyze the following resume against the job requirements using a strict 100-point rubric.

JOB DETAILS:
- Title: ${job.title}
- Description: ${job.description.slice(0, 1500)}
- Required Skills: ${skillsList}
- Experience Level: ${job.experienceLevel}
- Type: ${job.type}

RESUME TEXT:
${resumeText.slice(0, MAX_RESUME_LENGTH)}

SCORING RUBRIC (100 Points Total):
1. Projects (30 points max): Evaluate strictly the top 3 most relevant or impressive projects. Give up to 10 points per project based on complexity, relevance to the job, and impact. Ignore all other projects.
2. Skills Match (30 points max): Directly correlates with the percentage of required skills found. Be strict. If there's no concrete evidence for a skill, count it as missing.
3. Experience Alignment (25 points max): Evaluate depth and relevance of work history against the required experience level.
4. Education/Format (15 points max): Evaluate educational background and overall resume clarity.

INSTRUCTIONS:
1. Identify matched and missing skills from the required list.
2. Calculate the score for each section based on the rubric.
3. The overallScore must be exactly the sum of the four section scores.

Respond with ONLY a valid JSON object matching this exact schema:
{
  "scores": {
    "projects": <number 0-30>,
    "skills": <number 0-30>,
    "experience": <number 0-25>,
    "education": <number 0-15>
  },
  "overallScore": <number 0-100, exactly the sum of the scores above>,
  "skillMatchPercent": <number 0-100, percentage of required skills matched>,
  "matchedSkills": ["<skill1>", "<skill2>"],
  "missingSkills": ["<skill1>", "<skill2>"],
  "recommendation": "<shortlist|review|reject>",
  "summary": "<2-4 sentence assessment summary explaining the scores>"
}

Return ONLY the JSON object, no markdown or extra text.`;
}

export interface BatchScoredCandidate {
  candidateId: string;
  scores: {
    projects: number;
    skills: number;
    experience: number;
    education: number;
  };
  overallScore: number;
  skillMatchPercent: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendation: "shortlist" | "review" | "reject";
  assessmentSummary: string;
  error: string | null;
}

const SCORING_MODEL_CANDIDATES = getOpenRouterModelCandidates(
  process.env.OPENROUTER_MODEL,
  process.env.GOOGLE_AI_FEEDBACK_MODEL,
  "openai/gpt-4o-mini"
);

/**
 * Score a single candidate's resume against a job description using LLM.
 */
async function scoreOneCandidate(
  candidate: { id: string; resumeText: string },
  job: RecruitmentJob
): Promise<BatchScoredCandidate> {
  try {
    const prompt = buildBatchScreeningPrompt(candidate.resumeText, job);

    const raw = await generateOpenRouterJson<RawBatchScreeningResponse>({
      prompt,
      modelCandidates: SCORING_MODEL_CANDIDATES,
      temperature: LLM_SCORING_TEMPERATURE,
      maxTokens: LLM_SCORING_MAX_TOKENS,
    });

    const overallScore = clamp(raw.overallScore, 0, 100);
    const skillMatchPercent = clamp(raw.skillMatchPercent, 0, 100);

    return {
      candidateId: candidate.id,
      scores: {
        projects: clamp(raw.scores?.projects || 0, 0, 30),
        skills: clamp(raw.scores?.skills || 0, 0, 30),
        experience: clamp(raw.scores?.experience || 0, 0, 25),
        education: clamp(raw.scores?.education || 0, 0, 15),
      },
      overallScore,
      skillMatchPercent,
      matchedSkills: sanitizeStringArray(raw.matchedSkills, 20, 100),
      missingSkills: sanitizeStringArray(raw.missingSkills, 15, 100),
      recommendation: normalizeRecommendation(raw.recommendation, overallScore),
      assessmentSummary:
        typeof raw.summary === "string"
          ? raw.summary.trim().slice(0, 2000)
          : "",
      error: null,
    };
  } catch (err) {
    return {
      candidateId: candidate.id,
      scores: { projects: 0, skills: 0, experience: 0, education: 0 },
      overallScore: 0,
      skillMatchPercent: 0,
      matchedSkills: [],
      missingSkills: [],
      recommendation: "reject",
      assessmentSummary: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Batch-score multiple candidates against a job description.
 *
 * Processes candidates in parallel with controlled concurrency
 * to balance throughput vs. API rate limits.
 *
 * @param candidates Array of { id, resumeText } for candidates that passed semantic filtering.
 * @param job The recruitment job to score against.
 * @param concurrency Max simultaneous LLM calls (default: from config).
 * @param onProgress Optional callback reporting completed count.
 * @returns Array of scored candidates, parallel to input.
 */
export async function batchScoreCandidates(
  candidates: Array<{ id: string; resumeText: string }>,
  job: RecruitmentJob,
  concurrency: number = LLM_SCORING_CONCURRENCY,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchScoredCandidate[]> {
  if (!hasOpenRouterKey()) {
    throw new Error("AI scoring is not configured (missing OPENROUTER_API_KEY)");
  }

  // Deduplicate by resumeText to avoid 429s and save cost on identical resumes
  const uniqueResumes = new Map<string, { id: string; resumeText: string }>();
  for (const c of candidates) {
    if (c.resumeText && c.resumeText.trim()) {
      // Use the first candidate id encountered for this unique text as the primary
      if (!uniqueResumes.has(c.resumeText)) {
        uniqueResumes.set(c.resumeText, { id: c.id, resumeText: c.resumeText });
      }
    }
  }

  const uniqueCandidates = Array.from(uniqueResumes.values());
  const uniqueResultsMap = new Map<string, Omit<BatchScoredCandidate, "candidateId">>();
  let completed = 0;

  // Process unique candidates in concurrent batches
  const safeConcurrency = Math.max(1, Math.min(concurrency, 20));

  for (let i = 0; i < uniqueCandidates.length; i += safeConcurrency) {
    const batch = uniqueCandidates.slice(i, i + safeConcurrency);

    const batchResults = await Promise.allSettled(
      batch.map((candidate) => scoreOneCandidate(candidate, job))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const primaryCandidate = batch[j];
      let scoreData: Omit<BatchScoredCandidate, "candidateId">;

      if (result.status === "fulfilled") {
        const { candidateId, ...rest } = result.value;
        scoreData = rest;
      } else {
        scoreData = {
          scores: { projects: 0, skills: 0, experience: 0, education: 0 },
          overallScore: 0,
          skillMatchPercent: 0,
          matchedSkills: [],
          missingSkills: [],
          recommendation: "reject",
          assessmentSummary: "",
          error: result.reason?.message || "Scoring failed",
        };
      }
      uniqueResultsMap.set(primaryCandidate.resumeText, scoreData);
      completed++;
    }

    onProgress?.(completed, uniqueCandidates.length);

    // Small delay between batches to avoid rate limiting
    if (i + safeConcurrency < uniqueCandidates.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
    }
  }

  // Map results back to all original candidates
  return candidates.map((candidate) => {
    const scoreData = uniqueResultsMap.get(candidate.resumeText) || {
      scores: { projects: 0, skills: 0, experience: 0, education: 0 },
      overallScore: 0,
      skillMatchPercent: 0,
      matchedSkills: [],
      missingSkills: [],
      recommendation: "reject",
      assessmentSummary: "",
      error: "Invalid or empty resume text",
    };

    return {
      candidateId: candidate.id,
      ...scoreData,
    };
  });
}

/**
 * Persist batch scoring results to Firestore.
 * Updates the bulk_candidates documents with LLM scores.
 */
export async function persistBatchScores(
  scores: BatchScoredCandidate[]
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  // Use Firestore batched writes (max 500 per batch)
  const BATCH_SIZE = 490;
  for (let i = 0; i < scores.length; i += BATCH_SIZE) {
    const chunk = scores.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const score of chunk) {
      if (score.error) {
        failed++;
        continue;
      }

      const ref = db.collection(COLLECTION_BULK_CANDIDATES).doc(score.candidateId);
      batch.update(ref, {
        resumeScoreBreakdown: score.scores,
        llmScore: score.overallScore,
        skillMatchPercent: score.skillMatchPercent,
        matchedSkills: score.matchedSkills,
        missingSkills: score.missingSkills,
        recommendation: score.recommendation,
        assessmentSummary: score.assessmentSummary,
      });
      updated++;
    }

    await batch.commit();
  }

  return { updated, failed };
}

/**
 * Select the top N candidates from scored results.
 * Returns candidate IDs sorted by llmScore descending.
 */
export function selectTopNCandidates(
  scores: BatchScoredCandidate[],
  topN: number
): string[] {
  return scores
    .filter((s) => !s.error && s.overallScore > 0)
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, Math.max(1, topN))
    .map((s) => s.candidateId);
}
