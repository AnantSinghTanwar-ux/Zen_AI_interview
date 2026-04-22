import crypto from "crypto";
import type { ApplicationScore } from "@/types/external-application";

const DEFAULT_RECRUITER_SCORE_SIGNATURE_KEY = "zenai-default-recruiter-score-signature";

function getSignatureSecret(): string {
  const configured = String(process.env.RECRUITER_SCORE_SIGNATURE_KEY || "").trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    console.warn("[score-integrity] RECRUITER_SCORE_SIGNATURE_KEY not set — using default key. Set this env var for production security.");
  }

  return DEFAULT_RECRUITER_SCORE_SIGNATURE_KEY;
}

function normalizeArray(values: string[] | undefined): string[] {
  return Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
}

export function buildScoreFingerprintInput(score: {
  applicationId: string;
  interviewId: string;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  recommendation: string;
  strengths?: string[];
  weaknesses?: string[];
  feedbackSummary?: string;
  generatedBy?: string;
  createdAt?: string;
}): string {
  const payload = {
    applicationId: String(score.applicationId || "").trim(),
    interviewId: String(score.interviewId || "").trim(),
    overallScore: Number(score.overallScore || 0),
    technicalScore: Number(score.technicalScore || 0),
    communicationScore: Number(score.communicationScore || 0),
    problemSolvingScore: Number(score.problemSolvingScore || 0),
    recommendation: String(score.recommendation || "").trim().toLowerCase(),
    strengths: normalizeArray(score.strengths),
    weaknesses: normalizeArray(score.weaknesses),
    feedbackSummary: String(score.feedbackSummary || "").trim(),
    generatedBy: String(score.generatedBy || "").trim().toLowerCase(),
    createdAt: String(score.createdAt || "").trim(),
  };

  return JSON.stringify(payload);
}

export function computeScoreSignature(payload: string): string {
  return crypto
    .createHmac("sha256", getSignatureSecret())
    .update(payload)
    .digest("hex");
}

export function verifyScoreSignature(params: {
  payload: string;
  expectedSignature?: string | null;
}): boolean {
  const expected = String(params.expectedSignature || "").trim();
  if (!expected) return false;

  const computed = computeScoreSignature(params.payload);

  const expectedBuffer = Buffer.from(expected, "utf8");
  const computedBuffer = Buffer.from(computed, "utf8");
  if (expectedBuffer.length !== computedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
}

export function attachScoreIntegrityFields(score: Omit<ApplicationScore, "id">): {
  payload: string;
  signature: string;
} {
  const payload = buildScoreFingerprintInput(score);
  return {
    payload,
    signature: computeScoreSignature(payload),
  };
}
