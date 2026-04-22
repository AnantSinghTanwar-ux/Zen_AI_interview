import { RECRUITER_EMAIL } from "@/types/external-application";

function normalizeEmail(value: string): string {
  return String(value || "").trim().toLowerCase();
}

let cachedAllowedRecruiterEmails: string[] | null = null;

function resolveAllowedRecruiterEmails(): string[] {
  if (cachedAllowedRecruiterEmails) {
    return cachedAllowedRecruiterEmails;
  }

  const envEmails = String(process.env.RECRUITER_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  const fallbackRecruiter = normalizeEmail(RECRUITER_EMAIL);

  const merged = Array.from(new Set([...envEmails, fallbackRecruiter].filter(Boolean)));
  cachedAllowedRecruiterEmails = merged;
  return merged;
}

export function getAllowedRecruiterEmails(): string[] {
  return resolveAllowedRecruiterEmails();
}

export function isAllowedRecruiterEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(String(email || ""));
  if (!normalized) return false;
  return resolveAllowedRecruiterEmails().includes(normalized);
}
