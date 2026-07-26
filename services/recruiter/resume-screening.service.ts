import { db } from "@/services/firebase/admin";
import type { RecruitmentJob, ResumeScreeningResult } from "@/types/recruiter";
import {
  generateOpenRouterJson,
  getOpenRouterModelCandidates,
  hasOpenRouterKey,
} from "@/services/ai/openrouter-client";

const COLLECTION = "resume_screenings";

// Maximum resume text length to send to AI (chars). Prevents abuse and controls cost.
const MAX_RESUME_LENGTH = 12_000;

interface RawScreeningResponse {
  overallScore: number;
  skillMatchPercent: number;
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  recommendation: "shortlist" | "review" | "reject";
  summary: string;
}

function clamp(value: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function sanitizeStringArray(arr: unknown, maxItems = 10, maxLen = 300): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((s) => s.trim().slice(0, maxLen));
}

function normalizeRecommendation(
  rec: unknown,
  score: number
): "shortlist" | "review" | "reject" {
  const value = String(rec || "").toLowerCase().trim();

  if (value === "shortlist" || value === "strong_hire" || value === "hire") {
    return "shortlist";
  }
  if (value === "reject" || value === "no_hire") {
    return "reject";
  }
  if (value === "review" || value === "maybe") {
    return "review";
  }

  // Derive from score if AI returned garbage
  if (score >= 70) return "shortlist";
  if (score >= 45) return "review";
  return "reject";
}

function validateAndNormalize(raw: RawScreeningResponse): Omit<ResumeScreeningResult, "id" | "applicantId" | "jobId" | "createdAt"> {
  const overallScore = clamp(raw.overallScore, 0, 100);
  const skillMatchPercent = clamp(raw.skillMatchPercent, 0, 100);

  return {
    overallScore,
    skillMatchPercent,
    matchedSkills: sanitizeStringArray(raw.matchedSkills, 20, 100),
    missingSkills: sanitizeStringArray(raw.missingSkills, 15, 100),
    strengths: sanitizeStringArray(raw.strengths, 8),
    weaknesses: sanitizeStringArray(raw.weaknesses, 8),
    recommendation: normalizeRecommendation(raw.recommendation, overallScore),
    summary: typeof raw.summary === "string" ? raw.summary.trim().slice(0, 2000) : "",
  };
}

function buildScreeningPrompt(resumeText: string, job: RecruitmentJob): string {
  const skillsList = job.requiredSkills.join(", ");

  return `You are an expert recruitment AI screening assistant. Analyze the following resume against the job requirements and provide a detailed evaluation.

JOB DETAILS:
- Title: ${job.title}
- Description: ${job.description.slice(0, 1500)}
- Required Skills: ${skillsList}
- Experience Level: ${job.experienceLevel}
- Type: ${job.type}

RESUME TEXT:
${resumeText.slice(0, MAX_RESUME_LENGTH)}

INSTRUCTIONS:
1. Compare the resume against the job requirements objectively.
2. Identify matched and missing skills from the required list.
3. Be strict but fair in scoring.
4. If the resume lacks concrete evidence for a skill, count it as missing.
5. Consider experience level alignment.

Respond with ONLY a valid JSON object matching this exact schema:
{
  "overallScore": <number 0-100>,
  "skillMatchPercent": <number 0-100, percentage of required skills matched>,
  "matchedSkills": ["<skill1>", "<skill2>"],
  "missingSkills": ["<skill1>", "<skill2>"],
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>"],
  "recommendation": "<shortlist|review|reject>",
  "summary": "<2-4 sentence assessment summary>"
}

Return ONLY the JSON object, no markdown or extra text.`;
}

class ResumeScreeningService {
  /**
   * Run AI screening on a resume against a job posting.
   * Returns the screening result ID.
   */
  async screenResume(params: {
    applicantId: string;
    jobId: string;
    resumeText: string;
    job: RecruitmentJob;
  }): Promise<ResumeScreeningResult> {
    const { applicantId, jobId, resumeText, job } = params;

    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text is too short for meaningful screening");
    }

    if (!hasOpenRouterKey()) {
      throw new Error("AI screening is not configured (missing OPENROUTER_API_KEY)");
    }

    const prompt = buildScreeningPrompt(resumeText, job);

    const raw = await generateOpenRouterJson<RawScreeningResponse>({
      prompt,
      modelCandidates: getOpenRouterModelCandidates(
        process.env.OPENROUTER_MODEL,
        process.env.GOOGLE_AI_FEEDBACK_MODEL,
        "openai/gpt-4o-mini"
      ),
      temperature: 0.15,
      maxTokens: 1_500,
    });

    const normalized = validateAndNormalize(raw);

    const docRef = await db.collection(COLLECTION).add({
      applicantId,
      jobId,
      ...normalized,
      createdAt: new Date().toISOString(),
    });

    return {
      id: docRef.id,
      applicantId,
      jobId,
      ...normalized,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get the screening result for an applicant.
   * Returns the most recent result if multiple exist.
   */
  async getScreeningByApplicant(applicantId: string): Promise<ResumeScreeningResult | null> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("applicantId", "==", applicantId)
      .get();

    if (snapshot.empty) return null;

    // Return most recent
    const docs = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as ResumeScreeningResult)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return docs[0];
  }

  /**
   * Get all screening results for a job.
   */
  async getScreeningsByJob(jobId: string): Promise<ResumeScreeningResult[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("jobId", "==", jobId)
      .get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as ResumeScreeningResult)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const resumeScreeningService = new ResumeScreeningService();
