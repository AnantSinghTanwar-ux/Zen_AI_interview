import { MAX_RESUME_LENGTH, MIN_RESUME_TEXT_LENGTH } from "@/constants/screening.config";

// ─── Regex Patterns for Contact Extraction ──────────────────────────────────
//
// These patterns extract structured contact data from raw resume text
// with zero AI cost. Accuracy is ~95% for well-formatted resumes.

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const PHONE_REGEX =
  /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

const LINKEDIN_REGEX =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/gi;

// Common noise emails to filter out (company domains, template placeholders)
const NOISE_EMAIL_PATTERNS = [
  /noreply@/i,
  /no-reply@/i,
  /support@/i,
  /info@/i,
  /contact@/i,
  /admin@/i,
  /help@/i,
  /example\.com$/i,
  /test\.com$/i,
  /placeholder/i,
];

// ─── Text Extraction ────────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer using pdfjs-dist.
 * This is CPU-only, no external API calls.
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid loading the full library at module scope
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data: uint8 }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n").trim();
}

/**
 * Extract text from a DOCX buffer using mammoth.
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

/**
 * Extract text from a plain text buffer.
 */
export function extractTextFromTXT(buffer: Buffer): string {
  return buffer.toString("utf-8").trim();
}

/**
 * Route extraction based on file extension.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop() || "";

  let text: string;
  switch (ext) {
    case "pdf":
      text = await extractTextFromPDF(buffer);
      break;
    case "docx":
    case "doc":
      text = await extractTextFromDOCX(buffer);
      break;
    case "txt":
      text = extractTextFromTXT(buffer);
      break;
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }

  // Truncate to max length to control downstream costs
  return text.slice(0, MAX_RESUME_LENGTH);
}

// ─── Contact Extraction ─────────────────────────────────────────────────────

export interface ExtractedContacts {
  email: string | null;
  phone: string | null;
  name: string | null;
  linkedIn: string | null;
}

/**
 * Determine if an email looks like a personal candidate email
 * (not a company/template address).
 */
function isPersonalEmail(email: string): boolean {
  return !NOISE_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}

/**
 * Extract candidate name from resume text.
 *
 * Heuristic: The first non-empty, non-contact line that is:
 * - 2-5 words long
 * - Doesn't contain numbers (except for suffixes like "III")
 * - Isn't a common section heading
 */
function extractName(text: string): string | null {
  const headings = new Set([
    "resume",
    "curriculum vitae",
    "cv",
    "objective",
    "summary",
    "experience",
    "education",
    "skills",
    "contact",
    "profile",
    "about",
    "about me",
    "professional summary",
    "career objective",
  ]);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 10)) {
    // Skip lines with email/phone/URL
    if (
      EMAIL_REGEX.test(line) ||
      PHONE_REGEX.test(line) ||
      /https?:\/\//i.test(line)
    ) {
      // Reset lastIndex for global regexes
      EMAIL_REGEX.lastIndex = 0;
      PHONE_REGEX.lastIndex = 0;
      continue;
    }

    // Reset lastIndex
    EMAIL_REGEX.lastIndex = 0;
    PHONE_REGEX.lastIndex = 0;

    const cleaned = line.replace(/[|•·,\-–—]/g, " ").trim();
    const lower = cleaned.toLowerCase();

    // Skip section headings
    if (headings.has(lower)) continue;

    // Name heuristic: 2-5 words, mostly alpha characters
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;

    // Each word should be mostly alphabetic
    const allAlpha = words.every(
      (w) => /^[A-Za-z'.]+$/.test(w) || /^[IVX]+$/.test(w)
    );
    if (!allAlpha) continue;

    // Capitalize properly
    return words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return null;
}

/**
 * Extract all contact information from resume text using regex.
 * No AI calls — pure pattern matching.
 *
 * @returns The most likely personal email, first phone number,
 *          extracted name, and LinkedIn URL.
 */
export function extractContacts(text: string): ExtractedContacts {
  // Reset global regex lastIndex
  EMAIL_REGEX.lastIndex = 0;
  PHONE_REGEX.lastIndex = 0;
  LINKEDIN_REGEX.lastIndex = 0;

  // Extract all emails, filter noise, pick the first personal one
  const allEmails = (text.match(EMAIL_REGEX) || [])
    .map((e) => e.toLowerCase().trim())
    .filter(isPersonalEmail);
  const email = allEmails.length > 0 ? allEmails[0] : null;

  // Extract phone — take the first match
  const phones = text.match(PHONE_REGEX) || [];
  const phone = phones.length > 0 ? phones[0].trim() : null;

  // Extract LinkedIn URL
  const linkedInMatches = text.match(LINKEDIN_REGEX) || [];
  const linkedIn =
    linkedInMatches.length > 0
      ? linkedInMatches[0].replace(/\/$/, "").trim()
      : null;

  // Extract name
  const name = extractName(text);

  return { email, phone, name, linkedIn };
}

/**
 * Validate that extracted text is sufficient for screening.
 */
export function isResumeTextValid(text: string): boolean {
  return typeof text === "string" && text.trim().length >= MIN_RESUME_TEXT_LENGTH;
}
