import crypto from "crypto";
import {
  INTERVIEW_LINK_EXPIRY_DAYS,
} from "@/constants/screening.config";

// ─── Interview Token Service ────────────────────────────────────────────────
//
// Generates unique, secure interview tokens for shortlisted candidates.
// Each token encodes the candidate + job context and has a built-in expiry.

const TOKEN_SECRET =
  process.env.INTERVIEW_TOKEN_SECRET || "zenai-interview-default-key";

/**
 * Generate a unique interview token for a candidate.
 * Token is an HMAC-SHA256 hash truncated to 32 hex chars.
 */
export function generateInterviewToken(
  candidateId: string,
  jobId: string,
  bulkJobId: string
): string {
  const payload = `${candidateId}:${jobId}:${bulkJobId}:${Date.now()}:${crypto.randomBytes(8).toString("hex")}`;
  return crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Build the full interview URL for a candidate.
 */
export function buildInterviewLink(token: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://zen-ai-interview.vercel.app";
  return `${baseUrl}/interview/join?token=${token}`;
}

/**
 * Calculate the interview link expiry date.
 */
export function getInterviewDeadline(): Date {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + INTERVIEW_LINK_EXPIRY_DAYS);
  return deadline;
}

/**
 * Format a deadline date for display in emails.
 */
export function formatDeadline(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
